import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, HelpCircle, Trash2, Eye, RefreshCw } from 'lucide-react';
import type { Task } from '@/components/TaskTable';
import type { UploadedFile, MatchStatus } from '@shared/schema';
import ExtractedTextDialog from './ExtractedTextDialog';

interface FilesPanelProps {
  tasks: Task[];
}

export default function FilesPanel({ tasks }: FilesPanelProps) {
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [isTextDialogOpen, setIsTextDialogOpen] = useState(false);
  const [reprocessingFileId, setReprocessingFileId] = useState<string | null>(null);

  const loadExistingFiles = async () => {
    try {
      const response = await fetch('/api/files');
      if (response.ok) {
        const files = await response.json();
        setUploadedFiles(files);
      }
    } catch (error) {
      console.error('Failed to load existing files:', error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    loadExistingFiles();
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    await uploadFiles(files);
    e.target.value = '';
  }, []);

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Upload failed');
        }

        const uploadedFile: UploadedFile = await response.json();
        setUploadedFiles(prev => [uploadedFile, ...prev]);

        toast({
          title: "File Uploaded",
          description: `${file.name} has been uploaded and is being processed.`,
        });

        if (uploadedFile.matchStatus === 'pending') {
          await processFile(uploadedFile.id);
        }
      } catch (error: any) {
        toast({
          title: "Upload Failed",
          description: error.message || `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    }

    setIsUploading(false);
  };

  const processFile = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Processing failed');
      }

      const processedFile: UploadedFile = await response.json();
      setUploadedFiles(prev => 
        prev.map(f => f.id === fileId ? processedFile : f)
      );

      const statusMessage = {
        'full_match': 'Full match found!',
        'partial_match': 'Partial match found.',
        'no_match': 'No matching invoice found.',
        'pending': 'Still processing...',
      }[processedFile.matchStatus];

      toast({
        title: "Processing Complete",
        description: statusMessage,
      });
    } catch (error: any) {
      toast({
        title: "Processing Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteFile = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
      toast({
        title: "File Deleted",
        description: "The file has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const viewExtractedText = (file: UploadedFile) => {
    setSelectedFile(file);
    setIsTextDialogOpen(true);
  };

  const reprocessFile = async (fileId: string) => {
    setReprocessingFileId(fileId);
    try {
      const response = await fetch(`/api/files/${fileId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Reprocessing failed');
      }

      const processedFile: UploadedFile = await response.json();
      setUploadedFiles(prev => 
        prev.map(f => f.id === fileId ? processedFile : f)
      );

      toast({
        title: "Reprocessing Complete",
        description: "The file has been reprocessed with AI.",
      });
    } catch (error: any) {
      toast({
        title: "Reprocessing Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setReprocessingFileId(null);
    }
  };

  const getStatusBadge = (status: MatchStatus) => {
    switch (status) {
      case 'full_match':
        return (
          <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case 'partial_match':
        return (
          <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            Needs Review
          </Badge>
        );
      case 'no_match':
        return (
          <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30">
            <HelpCircle className="h-3 w-3 mr-1" />
            No Match
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Contractor Invoices
          </CardTitle>
          <CardDescription>
            Upload contractor invoices (PDF, Word, images, or text files) to match against system-generated invoices.
            AI will extract invoice details and compare them with your task data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-muted-foreground">Uploading files...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="font-medium">Drag and drop files here</p>
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                </div>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  data-testid="input-file-upload"
                />
                <Button 
                  variant="outline" 
                  onClick={() => document.getElementById('file-upload')?.click()}
                  data-testid="button-browse-files"
                >
                  Browse Files
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Supported: PDF, Word (.doc, .docx), Images (.png, .jpg), Text (.txt)
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Uploaded Files ({uploadedFiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-start justify-between p-4 rounded-lg border bg-card"
                  data-testid={`file-item-${file.id}`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <FileText className="h-8 w-8 text-muted-foreground shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{file.originalName}</p>
                        {getStatusBadge(file.matchStatus)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(file.size)} • Uploaded {new Date(file.uploadedAt).toLocaleString()}
                      </p>
                      
                      {file.extractedData && (
                        <div className="mt-2 p-3 rounded bg-muted/50 text-sm space-y-1">
                          {file.extractedData.staffName && (
                            <p><span className="text-muted-foreground">Staff:</span> {file.extractedData.staffName}</p>
                          )}
                          {file.extractedData.totalAmount != null && (
                            <p><span className="text-muted-foreground">Amount:</span> ${file.extractedData.totalAmount.toFixed(2)}</p>
                          )}
                          {file.extractedData.date && (
                            <p><span className="text-muted-foreground">Date:</span> {file.extractedData.date}</p>
                          )}
                          {file.extractedData.propertyName && (
                            <p><span className="text-muted-foreground">Property:</span> {file.extractedData.propertyName}</p>
                          )}
                        </div>
                      )}

                      {file.matchDetails && (
                        <p className="mt-2 text-sm text-muted-foreground italic">
                          {file.matchDetails}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {file.extractedData && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => viewExtractedText(file)}
                        className="text-muted-foreground"
                        title="View extracted text"
                        data-testid={`button-view-text-${file.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {file.matchStatus !== 'pending' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => reprocessFile(file.id)}
                        disabled={reprocessingFileId === file.id}
                        className="text-muted-foreground"
                        title="Reprocess file"
                        data-testid={`button-reprocess-file-${file.id}`}
                      >
                        {reprocessingFileId === file.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteFile(file.id)}
                      className="text-muted-foreground"
                      title="Delete file"
                      data-testid={`button-delete-file-${file.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tasks.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Load tasks first to enable invoice matching. Go to Settings to configure your API connection.
            </p>
          </CardContent>
        </Card>
      )}

      <ExtractedTextDialog
        file={selectedFile}
        open={isTextDialogOpen}
        onOpenChange={setIsTextDialogOpen}
      />
    </div>
  );
}