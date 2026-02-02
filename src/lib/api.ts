import axios from 'axios';

const API_URL = 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_URL,
});

export const uploadVideo = async (file: File, userId: string, onProgress?: (progress: number) => void) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('user_id', userId);
  formData.append('title', file.name);

  const response = await api.post('/api/video/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    },
  });

  return response.data;
};
