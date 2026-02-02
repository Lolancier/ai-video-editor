import os
import shutil
import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional
from api.config import get_settings
from api.supabase_client import get_supabase
from moviepy.editor import VideoFileClip

router = APIRouter(prefix="/api/video", tags=["video"])
settings = get_settings()

def generate_thumbnail(video_path: str, output_path: str):
    try:
        with VideoFileClip(video_path) as clip:
            # Capture frame at 1s or middle if shorter
            time_point = min(1.0, clip.duration / 2) if clip.duration else 0
            clip.save_frame(output_path, t=time_point)
        return True
    except Exception as e:
        print(f"Failed to generate thumbnail for {video_path}: {e}")
        return False

@router.post("/upload")
async def upload_video(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    user_id: str = Form(...)  # In a real app, extract this from JWT token
):
    try:
        # Generate unique filename
        file_ext = os.path.splitext(file.filename)[1]
        file_id = str(uuid.uuid4())
        unique_filename = f"{file_id}{file_ext}"
        file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

        # Save file locally
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Get file size
        file_size = os.path.getsize(file_path)

        # Generate Thumbnail
        thumbnail_filename = f"{file_id}.jpg"
        thumbnail_path = os.path.join(settings.UPLOAD_DIR, thumbnail_filename)
        generate_thumbnail(file_path, thumbnail_path)

        # Create record in Supabase
        supabase = get_supabase()
        video_data = {
            "id": file_id,
            "user_id": user_id,
            "filename": file.filename,
            "original_path": file_path,
            "format": file_ext.lstrip('.'),
            "file_size": file_size,
            # "duration": 0, # Duration will be extracted later by processing worker
        }
        
        data, count = supabase.table("videos").insert(video_data).execute()

        return {
            "status": "success",
            "video_id": file_id,
            "filename": unique_filename,
            "message": "Video uploaded successfully"
        }

    except Exception as e:
        # Clean up file if error occurs
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync")
def sync_library(user_id: str):
    """
    Syncs the database with the local file system.
    1. Deletes records if file is missing.
    2. Generates thumbnails if missing.
    """
    try:
        supabase = get_supabase()
        
        # 1. Fetch all videos for the user
        response = supabase.table("videos").select("*").eq("user_id", user_id).execute()
        videos = response.data
        
        deleted_count = 0
        thumbnail_count = 0
        
        # 2. Check existence of each file
        for video in videos:
            local_filename = f"{video['id']}.{video['format']}"
            local_path = os.path.join(settings.UPLOAD_DIR, local_filename)
            
            # Check if video exists
            if not os.path.exists(local_path):
                # Fallback to original path check
                if os.path.exists(video['original_path']):
                    local_path = video['original_path']
                else:
                    print(f"File missing for video {video['id']}, deleting record.")
                    supabase.table("videos").delete().eq("id", video['id']).execute()
                    deleted_count += 1
                    continue
            
            # Check/Generate Thumbnail
            thumbnail_path = os.path.join(settings.UPLOAD_DIR, f"{video['id']}.jpg")
            if not os.path.exists(thumbnail_path):
                print(f"Generating missing thumbnail for {video['id']}")
                if generate_thumbnail(local_path, thumbnail_path):
                    thumbnail_count += 1
                
        return {
            "status": "success", 
            "message": f"Library synced. Removed {deleted_count} missing files. Generated {thumbnail_count} thumbnails."
        }
        
    except Exception as e:
        print(f"Sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{video_id}")
def delete_video(video_id: str):
    try:
        supabase = get_supabase()
        
        # Fetch video details to get path
        res = supabase.table("videos").select("*").eq("id", video_id).single().execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Video not found")
        
        video = res.data
        local_filename = f"{video['id']}.{video['format']}"
        local_path = os.path.join(settings.UPLOAD_DIR, local_filename)
        thumbnail_path = os.path.join(settings.UPLOAD_DIR, f"{video['id']}.jpg")
        
        # Delete files
        if os.path.exists(local_path):
            os.remove(local_path)
        if os.path.exists(thumbnail_path):
            os.remove(thumbnail_path)
            
        # Delete from DB
        supabase.table("videos").delete().eq("id", video_id).execute()
        
        return {"status": "success", "message": "Video deleted"}
        
    except Exception as e:
        print(f"Delete video error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
