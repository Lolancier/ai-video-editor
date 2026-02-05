import os
import shutil
import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional, List
from pydantic import BaseModel
from api.config import get_settings
from api.supabase_client import get_supabase
from moviepy.editor import VideoFileClip
import requests
import json
import sys
import time

router = APIRouter(prefix="/api/video", tags=["video"])
settings = get_settings()

class VideoGenRequest(BaseModel):
    prompt: str = ""
    image_url: Optional[str] = None
    url_list: Optional[List[str]] = None
    aspect_ratio: str = "3:2"
    size: str = "720P"

@router.post("/generate")
async def generate_video(request: VideoGenRequest):
    """
    Generate video from image and prompt using external API (grok-video-3).
    Supports single image (image_url) or batch (url_list).
    """
    if not settings.VIDEO_GEN_API_KEY:
        raise HTTPException(status_code=500, detail="Video generation API key not configured")

    url = f"https://{settings.VIDEO_GEN_HOST}/v1/video/create"
    
    # Ensure API key is pure ASCII
    api_key = settings.VIDEO_GEN_API_KEY.strip()
    try:
        api_key.encode('ascii')
    except UnicodeEncodeError:
        api_key = ''.join([i for i in api_key if ord(i) < 128])
        
    headers = {
        'Accept': 'application/json',
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    # Determine list of images to process
    images_to_process = []
    if request.url_list:
        # Clean URLs
        images_to_process = [u.strip().strip('`').strip() for u in request.url_list if u.strip()]
    elif request.image_url:
        images_to_process = [request.image_url]

    # If no images, and no prompt? (Assuming prompt is optional if image is provided, or vice versa)
    # But current API requires prompt. Let's assume user provides prompt for all images,
    # or if prompt is empty, maybe use a default?
    # For batch images, usually we apply the same prompt or just use image-to-video with minimal prompt.
    
    results = []

    for img_url in images_to_process:
        payload = {
            "model": settings.VIDEO_GEN_MODEL,
            "prompt": request.prompt or "Animate this image", # Provide default if empty
            "aspect_ratio": request.aspect_ratio,
            "size": request.size,
            "images": [img_url]
        }

        # Simple retry logic
        max_retries = 3
        success = False
        
        for attempt in range(max_retries):
            try:
                print(f"Sending POST request to {url} for {img_url} (Attempt {attempt+1}/{max_retries})", flush=True)
                # Adding a small delay before request to avoid rate limiting
                if attempt > 0:
                    time.sleep(2)
                
                # Explicitly disable proxies to avoid local proxy errors
                response = requests.post(url, json=payload, headers=headers, timeout=60, proxies={"http": None, "https": None})
                
                if response.status_code == 200:
                    data = response.json()
                    results.append({
                        "status": "success",
                        "image_url": img_url,
                        "data": data
                    })
                    success = True
                    break
                else:
                    print(f"API Error ({response.status_code}): {response.text}", flush=True)
                    # If it's a server error (5xx), maybe retry. If 4xx, probably don't retry.
                    if 500 <= response.status_code < 600:
                        continue
                    else:
                        results.append({
                            "status": "failed",
                            "image_url": img_url,
                            "error": response.text,
                            "code": response.status_code
                        })
                        success = True # Handled as failure, but stop retrying
                        break
                        
            except Exception as e:
                print(f"Request exception for {img_url}: {str(e)}")
                if attempt == max_retries - 1:
                    results.append({
                        "status": "failed",
                        "image_url": img_url,
                        "error": str(e),
                        "code": 500
                    })
        
        # Add delay between different URLs processing
        time.sleep(1)

    # If it was a single request (no url_list), keep backward compatibility structure if possible?
        # Or just return list.
        # Front-end expects: { "status": "success", "data": { "id": ... } }
        
        if request.url_list:
             return {
                "status": "success",
                "batch": True,
                "results": results
            }
        else:
            # Single mode backward compatibility
            if not results:
                 # Case where prompt only? Not supported by my logic above yet.
                 # If prompt only, images_to_process is empty.
                 if request.prompt and not request.image_url and not request.url_list:
                      # Text to video
                      payload = {
                        "model": settings.VIDEO_GEN_MODEL,
                        "prompt": request.prompt,
                        "aspect_ratio": request.aspect_ratio,
                        "size": request.size,
                      }
                      response = requests.post(url, json=payload, headers=headers, timeout=60, proxies={"http": None, "https": None})
                      if response.status_code != 200:
                          raise HTTPException(status_code=response.status_code, detail=response.text)
                      return {
                          "status": "success",
                          "data": response.json()
                      }
            
            # Single image result
            if not results:
                 raise HTTPException(status_code=500, detail="No results generated")

            res = results[0]
            if res['status'] == 'success':
                return {
                    "status": "success",
                    "data": res['data']
                }
            else:
                raise HTTPException(status_code=res['code'], detail=res['error'])



@router.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """
    Query video generation task status.
    """
    if not settings.VIDEO_GEN_API_KEY:
        raise HTTPException(status_code=500, detail="Video generation API key not configured")

    try:
        url = f"https://{settings.VIDEO_GEN_HOST}/v1/video/query?id={task_id}"
        
        api_key = settings.VIDEO_GEN_API_KEY.strip()
        try:
            api_key.encode('ascii')
        except UnicodeEncodeError:
            api_key = ''.join([i for i in api_key if ord(i) < 128])

        headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        
        # Explicitly disable proxies
        response = requests.get(url, headers=headers, timeout=30, proxies={"http": None, "https": None})
        
        # print(f"Status Query Response ({task_id}): {response.text}", flush=True)

        if response.status_code != 200:
            print(f"Status API Error ({response.status_code})")
            raise HTTPException(status_code=response.status_code, detail=f"External API Error: {response.text}")
            
        return {
            "status": "success",
            "data": response.json()
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Status query error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

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
