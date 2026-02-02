from moviepy.editor import VideoFileClip
import os

video_path = r"D:\ai_video_editor\AI_video_Editor\api\uploads\8261573e-8553-47bc-9bdf-9997822e92cb.mov"
thumbnail_path = r"D:\ai_video_editor\AI_video_Editor\api\uploads\8261573e-8553-47bc-9bdf-9997822e92cb.jpg"

try:
    with VideoFileClip(video_path) as clip:
        time_point = min(1.0, clip.duration / 2) if clip.duration else 0
        clip.save_frame(thumbnail_path, t=time_point)
    print(f"Thumbnail generated at {thumbnail_path}")
except Exception as e:
    print(f"Error: {e}")
