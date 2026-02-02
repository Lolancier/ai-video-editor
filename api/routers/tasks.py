import uuid
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from api.config import get_settings
from api.supabase_client import get_supabase
from api.worker import start_processing_thread

router = APIRouter(prefix="/api/video", tags=["tasks"])
settings = get_settings()

class EditRequest(BaseModel):
    video_id: str
    user_id: str
    prompt: str
    parameters: Optional[Dict[str, Any]] = {}

@router.post("/edit")
def create_edit_task(request: EditRequest):
    try:
        task_id = str(uuid.uuid4())
        supabase = get_supabase()
        
        # Create task record
        task_data = {
            "id": task_id,
            "user_id": request.user_id,
            "video_id": request.video_id,
            "prompt": request.prompt,
            "parameters": request.parameters,
            "status": "pending",
            "progress": 0.0
        }
        
        data, count = supabase.table("tasks").insert(task_data).execute()
        
        # Trigger background processing worker
        start_processing_thread(task_id)

        return {
            "status": "success",
            "task_id": task_id,
            "message": "Edit task created successfully"
        }

    except Exception as e:
        error_msg = f"Error in create_edit_task: {str(e)}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        
        # Log to file
        with open("api_error.log", "a") as f:
            f.write(f"[{uuid.uuid4()}] {error_msg}\n")
            traceback.print_exc(file=f)
            
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/task/{task_id}")
def get_task_status(task_id: str):
    try:
        supabase = get_supabase()
        response = supabase.table("tasks").select("*").eq("id", task_id).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Task not found")
            
        task = response.data
        
        result_url = None
        if task["status"] == "completed":
            try:
                # Fetch result record to get the output path
                # Handle potential errors if multiple results or none
                result_res = supabase.table("results").select("*").eq("task_id", task_id).execute()
                if result_res.data and len(result_res.data) > 0:
                    # Take the latest one if multiple
                    result_data = result_res.data[0]
                    result_url = f"http://localhost:8000/outputs/{result_data['output_path']}"
                    format_type = result_data.get('format', 'mp4')
            except Exception as res_err:
                print(f"Error fetching result for task {task_id}: {res_err}")

        return {
            "task_id": task["id"],
            "status": task["status"],
            "progress": task["progress"],
            "result_url": result_url,
            "format": format_type if 'format_type' in locals() else None,
            "error_message": task.get("error_message")
        }

    except Exception as e:
        error_msg = f"Get task status error: {str(e)}"
        print(error_msg)
        with open("api_error.log", "a") as f:
            f.write(f"[{uuid.uuid4()}] {error_msg}\n")
            import traceback
            traceback.print_exc(file=f)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tasks")
def list_user_tasks(user_id: str):
    try:
        supabase = get_supabase()
        
        # 1. Fetch tasks only
        response = supabase.table("tasks").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        tasks_data = response.data
        
        if not tasks_data:
            return []

        # 2. Collect IDs
        video_ids = [t["video_id"] for t in tasks_data if t.get("video_id")]
        task_ids = [t["id"] for t in tasks_data]
        
        # 3. Fetch related videos (if any)
        videos_map = {}
        if video_ids:
            try:
                # Supabase 'in' filter expects a list
                # Note: supabase-py syntax might be .in_("id", video_ids)
                vid_res = supabase.table("videos").select("id, filename").in_("id", video_ids).execute()
                for v in vid_res.data:
                    videos_map[v["id"]] = v["filename"]
            except Exception as e:
                print(f"Error fetching videos: {e}")

        # 4. Fetch related results (if any)
        results_map = {}
        if task_ids:
            try:
                res_res = supabase.table("results").select("task_id, output_path, format").in_("task_id", task_ids).execute()
                for r in res_res.data:
                    # Assuming one result per task, or take the last one
                    results_map[r["task_id"]] = {
                        "path": r["output_path"],
                        "format": r.get("format", "mp4") # Default to mp4 if missing
                    }
            except Exception as e:
                print(f"Error fetching results: {e}")

        # 5. Merge data
        tasks = []
        for t in tasks_data:
            vid_id = t.get("video_id")
            original_filename = videos_map.get(vid_id, "Unknown")
            
            result_info = results_map.get(t["id"])
            result_url = None
            format_type = "mp4"
            
            if result_info:
                result_url = f"http://localhost:8000/outputs/{result_info['path']}"
                format_type = result_info['format']

            tasks.append({
                "id": t["id"],
                "status": t["status"],
                "created_at": t["created_at"],
                "prompt": t.get("prompt", ""),
                "result_url": result_url,
                "original_filename": original_filename,
                "format": format_type
            })
            
        return tasks
    except Exception as e:
        error_msg = f"List tasks error: {str(e)}"
        print(error_msg)
        # Log to file for debugging
        with open("api_error.log", "a") as f:
            f.write(error_msg + "\n")
            import traceback
            traceback.print_exc(file=f)
            
        raise HTTPException(status_code=500, detail=error_msg)

@router.delete("/task/{task_id}")
def delete_task(task_id: str):
    try:
        supabase = get_supabase()
        
        # 1. Get result file path to delete locally
        res = supabase.table("results").select("output_path").eq("task_id", task_id).execute()
        if res.data:
            for r in res.data:
                file_path = os.path.join(settings.OUTPUT_DIR, r['output_path'])
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"Deleted result file: {file_path}")
        
        # 2. Delete task (cascade should handle results, but let's be safe or rely on DB)
        # Assuming CASCADE DELETE is configured in DB for task->results. 
        # If not, we should delete result first.
        supabase.table("results").delete().eq("task_id", task_id).execute()
        supabase.table("tasks").delete().eq("id", task_id).execute()
        
        return {"status": "success", "message": "Task deleted"}
    except Exception as e:
        print(f"Delete task error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
