from moviepy.editor import AudioFileClip
import numpy as np
from scipy.io import wavfile
import os

def create_silent_mp3(filename, duration=5):
    try:
        sample_rate = 44100
        t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
        data = np.sin(2 * np.pi * 440 * t) * 0.1
        
        wav_path = filename.replace(".mp3", ".wav")
        wavfile.write(wav_path, sample_rate, data.astype(np.float32))
        
        # Check if moviepy can write mp3
        from moviepy.audio.io.AudioFileClip import AudioFileClip
        clip = AudioFileClip(wav_path)
        clip.write_audiofile(filename, verbose=False, logger=None)
        clip.close()
        os.remove(wav_path)
        print(f"Success: {filename}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    target_dir = os.path.join("api", "assets", "music")
    os.makedirs(target_dir, exist_ok=True)
    target = os.path.join(target_dir, "bgm.mp3")
    create_silent_mp3(target)
