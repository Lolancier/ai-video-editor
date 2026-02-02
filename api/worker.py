import time
import os
import threading
import uuid
import json
import re
from moviepy.editor import VideoFileClip, AudioFileClip, CompositeAudioClip
import moviepy.video.fx.all as vfx
from api.config import get_settings
from api.supabase_client import get_supabase
from openai import OpenAI
import google.generativeai as genai

settings = get_settings()

def analyze_instruction(prompt: str, video_duration: float):
    """
    Use DeepSeek (via OpenAI SDK) to analyze user instruction and return edit parameters.
    """
    if not settings.DEEPSEEK_API_KEY:
        print("DeepSeek API Key not found, using fallback logic.")
        return None

    try:
        client = OpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL
        )

        system_prompt = f"""
You are a professional video editing assistant.
The current video duration is {video_duration} seconds.
Based on the user's natural language instruction, output a JSON object containing a list of operations.

Supported operations:
1. 'subclip': Cut a segment of the video.
   - start: float (seconds, default 0)
   - end: float (seconds, default duration)
2. 'speed': Change playback speed.
   - factor: float (e.g., 2.0 for 2x speed, 0.5 for slow motion)
3. 'audio': Audio manipulation.
   - action: 'extract' (save audio as mp3), 'remove' (mute video), 'keep' (default)
   - volume: float (1.0 is original, 0.0 is mute, 0.5 is half volume)
4. 'bg_music': Add background music.
   - action: 'add'
   - volume: float (default 0.5)
5. 'auto_scene_cut': Automatically detect scenes and apply transitions or cuts.
   - action: 'detect_and_cut' (cut into scenes), 'detect_and_transition' (add transitions between scenes)
   - method: 'ai' (use Gemini if available) or 'classic' (use scenedetect)
   - threshold: float (default 27.0, sensitivity for classic)

Output format (JSON only, no markdown):
{{
    "operations": [
        {{ "type": "subclip", "start": 0, "end": 10 }},
        {{ "type": "speed", "factor": 1.5 }},
        {{ "type": "audio", "action": "keep", "volume": 1.0 }},
        {{ "type": "bg_music", "action": "add", "volume": 0.3 }},
        {{ "type": "auto_scene_cut", "action": "detect_and_cut", "method": "ai" }}
    ]
}}

Examples:
User: "Cut the first 5 seconds and play it at double speed"
Output: {{ "operations": [ {{ "type": "subclip", "start": 0, "end": 5 }}, {{ "type": "speed", "factor": 2.0 }} ] }}

User: "Extract the audio from the whole video"
Output: {{ "operations": [ {{ "type": "audio", "action": "extract" }} ] }}

User: "Mute the video and add background music"
Output: {{ "operations": [ {{ "type": "audio", "action": "remove" }}, {{ "type": "bg_music", "action": "add" }} ] }}

User: "Smartly cut the video to keep interesting parts"
Output: {{ "operations": [ {{ "type": "auto_scene_cut", "action": "detect_and_cut", "method": "ai" }} ] }}
"""

        response = client.chat.completions.create(
            model="deepseek-chat", 
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            response_format={ "type": "json_object" }, 
            temperature=0.1
        )

        content = response.choices[0].message.content
        print(f"DeepSeek Response: {content}")
        return json.loads(content)

    except Exception as e:
        print(f"LLM Analysis failed: {e}")
        return None

def analyze_video_with_gemini(video_path: str, instruction: str = "Identify the most interesting scenes"):
    """
    Uploads video to Gemini and asks for scene timestamps.
    Returns a list of tuples (start, end).
    """
    if not settings.GOOGLE_API_KEY:
        print("Google API Key not found.")
        return None
    
    try:
        genai.configure(api_key=settings.GOOGLE_API_KEY)
        
        print(f"Uploading file to Gemini: {video_path}")
        video_file = genai.upload_file(path=video_path)
        
        # Wait for processing
        while video_file.state.name == "PROCESSING":
            print("Waiting for Gemini to process video...")
            time.sleep(2)
            video_file = genai.get_file(video_file.name)
            
        if video_file.state.name == "FAILED":
            print("Gemini video processing failed.")
            return None
            
        print("Gemini video processing complete. Generating content...")
        
        prompt = f"""
        Analyze this video based on the following instruction: "{instruction}".
        Return a JSON object with a key "scenes" containing a list of segments that match the instruction.
        Each segment should have "start" and "end" timestamps in seconds (float).
        
        Example JSON:
        {{
            "scenes": [
                {{ "start": 0.0, "end": 5.5 }},
                {{ "start": 10.2, "end": 15.0 }}
            ]
        }}
        """
        
        models_to_try = ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-pro"]
        response = None
        
        for model_name in models_to_try:
            print(f"Trying model: {model_name}")
            # Simple retry logic for network flakes
            for attempt in range(3):
                try:
                    model = genai.GenerativeModel(model_name=model_name)
                    response = model.generate_content([video_file, prompt], request_options={"timeout": 600})
                    print(f"Success with {model_name}")
                    break # Break retry loop
                except Exception as e:
                    print(f"Model {model_name} failed (attempt {attempt+1}/3): {e}")
                    # Log this specific model failure too
                    try:
                        with open("api_error.log", "a") as f:
                            f.write(f"[{uuid.uuid4()}] Model {model_name} attempt {attempt+1} failed: {str(e)}\n")
                    except:
                        pass
                    time.sleep(2) # Wait before retry
            else:
                # If retry loop finished without break, continue to next model
                continue
            # If break, we found a working model
            break
                
        if not response:
            print("All Gemini models failed.")
            return None
            
        print(f"Gemini raw response: {response.text}")
        
        # Extract JSON from response
        text = response.text
        # Remove markdown code blocks if present
        text = re.sub(r"```json|```", "", text).strip()
        
        data = json.loads(text)
        scenes = []
        if "scenes" in data:
            for scene in data["scenes"]:
                scenes.append((float(scene["start"]), float(scene["end"])))
        
        # Cleanup
        try:
            genai.delete_file(video_file.name)
        except:
            pass
        
        return scenes
        
    except Exception as e:
        print(f"Gemini analysis failed: {e}")
        # Log detailed error to file
        try:
            with open("api_error.log", "a") as f:
                f.write(f"[{uuid.uuid4()}] Gemini Error: {str(e)}\n")
                import traceback
                traceback.print_exc(file=f)
        except:
            pass
        return None

def process_video_task(task_id: str):
    """
    Background worker to process video editing tasks.
    """
    supabase = get_supabase()
    
    try:
        # 1. Fetch task details
        task_res = supabase.table("tasks").select("*, videos(*)").eq("id", task_id).single().execute()
        task = task_res.data
        if not task:
            print(f"Task {task_id} not found")
            return

        video = task["videos"]
        input_path = video["original_path"]
        
        if not os.path.exists(input_path):
            error_msg = f"Input file not found: {input_path}"
            print(error_msg)
            supabase.table("tasks").update({
                "status": "failed", 
                "error_message": error_msg
            }).eq("id", task_id).execute()
            return

        # Update status to processing
        supabase.table("tasks").update({"status": "processing", "progress": 10}).eq("id", task_id).execute()
        
        clip = VideoFileClip(input_path)
        duration = clip.duration

        # 2. LLM Analysis (DeepSeek for planning)
        print(f"Analyzing video {video['id']} with prompt: {task['prompt']}")
        analysis_result = analyze_instruction(task['prompt'], duration)
        
        operations = []
        if analysis_result and "operations" in analysis_result:
            operations = analysis_result["operations"]
        elif analysis_result and "action" in analysis_result: # Backward compatibility
             operations = [{"type": "subclip", "start": analysis_result.get("start", 0), "end": analysis_result.get("end", duration)}]
        
        supabase.table("tasks").update({"progress": 30}).eq("id", task_id).execute()
        
        # 3. Perform Video Editing
        final_clip = clip
        output_format = "mp4"
        is_audio_only = False

        # Apply operations in sequence
        for op in operations:
            op_type = op.get("type")
            
            if op_type == "subclip":
                start = float(op.get("start", 0))
                end = float(op.get("end", final_clip.duration))
                start = max(0, min(start, final_clip.duration))
                end = max(0, min(end, final_clip.duration))
                if start < end:
                    print(f"Applying subclip: {start} -> {end}")
                    final_clip = final_clip.subclip(start, end)
            
            elif op_type == "speed":
                factor = float(op.get("factor", 1.0))
                if factor > 0 and factor != 1.0:
                    print(f"Applying speed: {factor}x")
                    final_clip = final_clip.fx(vfx.speedx, factor)
            
            elif op_type == "audio":
                action = op.get("action", "keep")
                volume = float(op.get("volume", 1.0))
                
                if action == "extract":
                    is_audio_only = True
                    output_format = "mp3"
                elif action == "remove":
                    print("Removing audio")
                    final_clip = final_clip.without_audio()
                elif volume != 1.0:
                    print(f"Adjusting volume: {volume}")
                    if final_clip.audio:
                        final_clip.audio = final_clip.audio.volumex(volume)

            elif op_type == "bg_music":
                bgm_volume = float(op.get("volume", 0.3))
                bgm_path = os.path.join("api", "assets", "music", "bgm.mp3")
                
                if not os.path.exists(bgm_path):
                     print(f"Background music file not found at {bgm_path}")
                else:
                    print(f"Adding background music from {bgm_path}")
                    try:
                        bgm_clip = AudioFileClip(bgm_path)
                        # Loop bgm to match video duration
                        if bgm_clip.duration < final_clip.duration:
                            bgm_clip = bgm_clip.fx(vfx.audio_loop, duration=final_clip.duration)
                        else:
                            bgm_clip = bgm_clip.subclip(0, final_clip.duration)
                        
                        bgm_clip = bgm_clip.volumex(bgm_volume)
                        
                        # Mix audio
                        if final_clip.audio:
                            final_audio = CompositeAudioClip([final_clip.audio, bgm_clip])
                        else:
                            final_audio = bgm_clip
                        
                        final_clip = final_clip.set_audio(final_audio)
                    except Exception as e:
                        print(f"Failed to add background music: {e}")

            elif op_type == "auto_scene_cut":
                print("Performing Smart Scene Cut...")
                
                # Check method
                method = op.get("method", "ai")
                if not settings.GOOGLE_API_KEY:
                    print("Google API Key missing, falling back to classic scenedetect")
                    method = "classic"
                
                scenes = []
                
                if method == "ai":
                    print("Using Gemini for scene detection...")
                    # Use the original prompt or a default one
                    instruction = task.get("prompt", "Identify the most interesting scenes")
                    # If prompt is just "Smart Scene Cut", refine it
                    if "smart scene cut" in instruction.lower() or "智能分镜" in instruction:
                        instruction = "Identify the start and end timestamps of distinct, high-quality scenes, excluding blurry or static shots."
                    
                    scenes = analyze_video_with_gemini(input_path, instruction)
                    
                    if not scenes:
                        print("Gemini returned no scenes.")
                        # Do NOT fallback silently if AI was requested
                        raise Exception("AI Scene Detection failed. Please check your Google API Key or Quota.")
                
                if method == "classic":
                    try:
                        from scenedetect import detect, ContentDetector
                        print("Using PySceneDetect...")
                        scene_list = detect(input_path, ContentDetector(threshold=27.0))
                        # Convert to simple tuples
                        scenes = [(s[0].get_seconds(), s[1].get_seconds()) for s in scene_list]
                    except ImportError:
                        print("scenedetect not installed")
                    except Exception as e:
                        print(f"Scene detection failed: {e}")

                if scenes:
                    print(f"Found {len(scenes)} scenes to keep.")
                    clips = []
                    for start_t, end_t in scenes:
                        # Ensure within bounds
                        start_t = max(0, min(start_t, final_clip.duration))
                        end_t = max(0, min(end_t, final_clip.duration))
                        
                        if end_t - start_t < 0.5: # Skip very short clips
                            continue
                            
                        s_clip = final_clip.subclip(start_t, end_t)
                        # Add fade in/out for smoothness
                        s_clip = s_clip.fx(vfx.fadein, 0.5).fx(vfx.fadeout, 0.5)
                        clips.append(s_clip)
                    
                    if clips:
                        from moviepy.editor import concatenate_videoclips
                        final_clip = concatenate_videoclips(clips, method="compose")
                else:
                    print("No scenes detected or kept.")

        # Generate output path
        output_filename = f"edited_{task_id}.{output_format}"
        output_path = os.path.join(settings.OUTPUT_DIR, output_filename)
        
        supabase.table("tasks").update({"progress": 70}).eq("id", task_id).execute()
        
        # Write output file
        if is_audio_only:
            if final_clip.audio:
                final_clip.audio.write_audiofile(output_path)
            else:
                raise Exception("Video has no audio track to extract")
        else:
            final_clip.write_videofile(output_path, codec="libx264", audio_codec="aac")
        
        final_clip.close()
        clip.close()
        
        # 4. Save Result
        result_id = str(uuid.uuid4())
        
        final_duration = 0
        if is_audio_only:
            if final_clip.audio:
                final_duration = int(final_clip.audio.duration or 0)
        else:
             final_duration = int(final_clip.duration or 0)

        result_data = {
            "id": result_id,
            "task_id": task_id,
            "output_path": output_filename,
            "duration": final_duration,
            "file_size": os.path.getsize(output_path),
            "format": output_format
        }
        
        supabase.table("results").insert(result_data).execute()
        
        # 5. Mark Task as Completed
        supabase.table("tasks").update({"status": "completed", "progress": 100, "completed_at": "now()"}).eq("id", task_id).execute()
        print(f"Task {task_id} completed successfully")

    except Exception as e:
        error_msg = f"Error processing task {task_id}: {str(e)}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        
        # Log to file
        with open("api_error.log", "a") as f:
            f.write(f"[{uuid.uuid4()}] {error_msg}\n")
            traceback.print_exc(file=f)
            
        supabase.table("tasks").update({
            "status": "failed", 
            "error_message": str(e)
        }).eq("id", task_id).execute()

def start_processing_thread(task_id: str):
    thread = threading.Thread(target=process_video_task, args=(task_id,))
    thread.daemon = True
    thread.start()
