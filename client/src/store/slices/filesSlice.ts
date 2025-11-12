import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { FileNode, FileSystemState } from '../../types';
import { ApiResponse } from '../../types';

// Async thunks
export const fetchFileSystem = createAsyncThunk('files/fetchFileSystem', async () => {
  const response = await fetch('/api/v1/filesystem');
  const data: ApiResponse<FileNode> = await response.json();

  if (!data.success || !data.data) {
    throw new Error(data.error || 'Failed to fetch filesystem');
  }

  return data.data;
});

export const readFile = createAsyncThunk('files/readFile', async (path: string) => {
  const response = await fetch(`/api/v1/files/read?path=${encodeURIComponent(path)}`);
  const data: ApiResponse<{ content: string }> = await response.json();

  if (!data.success || !data.data) {
    throw new Error(data.error || 'Failed to read file');
  }

  return { path, content: data.data.content };
});

export const writeFile = createAsyncThunk(
  'files/writeFile',
  async ({ path, content }: { path: string; content: string }) => {
    const response = await fetch('/api/v1/files/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
    const data: ApiResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to write file');
    }

    return { path, content };
  }
);

export const createFile = createAsyncThunk(
  'files/createFile',
  async ({ path, type }: { path: string; type: 'file' | 'directory' }) => {
    const response = await fetch('/api/v1/files/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, type }),
    });
    const data: ApiResponse<FileNode> = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to create file');
    }

    return data.data;
  }
);

export const deleteFile = createAsyncThunk('files/deleteFile', async (path: string) => {
  const response = await fetch(`/api/v1/files/delete?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
  });
  const data: ApiResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to delete file');
  }

  return path;
});

export const renameFile = createAsyncThunk(
  'files/renameFile',
  async ({ oldPath, newPath }: { oldPath: string; newPath: string }) => {
    const response = await fetch('/api/v1/files/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newPath }),
    });
    const data: ApiResponse<FileNode> = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to rename file');
    }

    return { oldPath, newPath, updatedNode: data.data };
  }
);

export const copyFile = createAsyncThunk(
  'files/copyFile',
  async ({ sourcePath, destinationPath }: { sourcePath: string; destinationPath: string }) => {
    const response = await fetch('/api/v1/files/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath, destinationPath }),
    });
    const data: ApiResponse<FileNode> = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to copy file');
    }

    return data.data;
  }
);

export const downloadFile = createAsyncThunk('files/downloadFile', async (path: string) => {
  const response = await fetch(`/api/v1/files/download?path=${encodeURIComponent(path)}`);

  if (!response.ok) {
    throw new Error('Failed to download file');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  // Extract filename from path
  const filename = path.split('/').pop() || 'download';
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

  return path;
});

const initialState: FileSystemState = {
  root: null,
  currentFile: null,
  openFiles: [],
  isLoading: false,
  error: null,
};

const filesSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    setCurrentFile: (state, action: PayloadAction<FileNode | null>) => {
      state.currentFile = action.payload;
    },
    addOpenFile: (state, action: PayloadAction<FileNode>) => {
      const exists = state.openFiles.find((f) => f.id === action.payload.id);
      if (!exists) {
        state.openFiles.push(action.payload);
      }
      state.currentFile = action.payload;
    },
    removeOpenFile: (state, action: PayloadAction<string>) => {
      state.openFiles = state.openFiles.filter((f) => f.id !== action.payload);
      if (state.currentFile?.id === action.payload) {
        state.currentFile =
          state.openFiles.length > 0 ? state.openFiles[state.openFiles.length - 1] : null;
      }
    },
    updateFileContent: (state, action: PayloadAction<{ fileId: string; content: string }>) => {
      const openFile = state.openFiles.find((f) => f.id === action.payload.fileId);
      if (openFile) {
        openFile.content = action.payload.content;
      }
      if (state.currentFile?.id === action.payload.fileId) {
        state.currentFile.content = action.payload.content;
      }
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch FileSystem
      .addCase(fetchFileSystem.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchFileSystem.fulfilled, (state, action) => {
        state.isLoading = false;
        state.root = action.payload;
        state.error = null;
      })
      .addCase(fetchFileSystem.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch filesystem';
      })
      // Read File
      .addCase(readFile.fulfilled, (state, action) => {
        const { path, content } = action.payload;
        // Update content in open files if they exist
        const openFile = state.openFiles.find((f) => f.path === path);
        if (openFile) {
          openFile.content = content;
        }
        if (state.currentFile?.path === path) {
          state.currentFile.content = content;
        }
      })
      .addCase(readFile.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to read file';
      })
      // Write File
      .addCase(writeFile.fulfilled, (state, action) => {
        const { path, content } = action.payload;
        // Update content in open files if they exist
        const openFile = state.openFiles.find((f) => f.path === path);
        if (openFile) {
          openFile.content = content;
        }
        if (state.currentFile?.path === path) {
          state.currentFile.content = content;
        }
      })
      .addCase(writeFile.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to write file';
      })
      // Create File
      .addCase(createFile.fulfilled, () => {
        // Could update the file tree here if needed
      })
      .addCase(createFile.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to create file';
      })
      // Delete File
      .addCase(deleteFile.fulfilled, (state, action) => {
        const path = action.payload;
        // Remove from open files
        state.openFiles = state.openFiles.filter((f) => f.path !== path);
        if (state.currentFile?.path === path) {
          state.currentFile =
            state.openFiles.length > 0 ? state.openFiles[state.openFiles.length - 1] : null;
        }
      })
      .addCase(deleteFile.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to delete file';
      })
      // Rename File
      .addCase(renameFile.fulfilled, (state, action) => {
        const { oldPath, updatedNode } = action.payload;
        // Update open files paths
        state.openFiles = state.openFiles.map((file) =>
          file.path === oldPath ? { ...file, ...updatedNode } : file
        );
        if (state.currentFile?.path === oldPath) {
          state.currentFile = { ...state.currentFile, ...updatedNode };
        }
      })
      .addCase(renameFile.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to rename file';
      })
      // Copy File
      .addCase(copyFile.fulfilled, () => {
        // File tree will be refreshed to show the new file
      })
      .addCase(copyFile.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to copy file';
      })
      // Download File
      .addCase(downloadFile.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to download file';
      });
  },
});

export const { setCurrentFile, addOpenFile, removeOpenFile, updateFileContent, clearError } =
  filesSlice.actions;

export default filesSlice.reducer;
