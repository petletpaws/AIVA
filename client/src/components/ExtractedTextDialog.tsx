import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Copy, Download, FileText, Check, AlertTriangle } from 'lucide-react';
import type { UploadedFile } from '@shared/schema';

interface ExtractedTextDialogProps {
  file: UploadedFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ExtractedTextDialog({ file, open, onOpenChange }: ExtractedTextDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!file) return null;

  const extractedText = file.extractedData?.rawTextFull || file.extractedData?.rawText || '';
  const hasText = extractedText.length > 0;
  const textLength = extractedText.length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "The extracted text has been copied.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy text to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([extractedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.originalName.replace(/\.[^/.]+$/, '')}_extracted.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded",
      description: "The extracted text has been downloaded.",
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Extracted Text
          </DialogTitle>
          <DialogDescription className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground">{file.originalName}</span>
              <Badge variant="secondary" className="text-xs">
                {formatFileSize(file.size)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {textLength.toLocaleString()} characters
              </Badge>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 pb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!hasText}
            data-testid="button-copy-extracted-text"
          >
            {copied ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {copied ? 'Copied' : 'Copy Text'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!hasText}
            data-testid="button-download-extracted-text"
          >
            <Download className="h-4 w-4 mr-2" />
            Download .txt
          </Button>
        </div>

        <div className="flex-1 min-h-0">
          {hasText ? (
            <ScrollArea className="h-[400px] rounded-md border bg-muted/30">
              <pre
                className="p-4 text-sm font-mono whitespace-pre-wrap break-words"
                data-testid="text-extracted-content"
              >
                {extractedText}
              </pre>
            </ScrollArea>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center text-center p-6 rounded-md border bg-muted/30">
              <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-medium">No text could be extracted</p>
              <p className="text-sm text-muted-foreground mt-1">
                This could happen if the file is empty, corrupted, or the format is not supported.
              </p>
            </div>
          )}
        </div>

        {file.extractedData && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">AI Extracted Data:</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex gap-2">
                <span className="text-muted-foreground">Staff:</span>
                <span data-testid="text-extracted-staff">{file.extractedData.staffName || 'Not detected'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground">Amount:</span>
                <span data-testid="text-extracted-amount">
                  {file.extractedData.totalAmount != null 
                    ? `$${file.extractedData.totalAmount.toFixed(2)}` 
                    : 'Not detected'}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground">Date:</span>
                <span data-testid="text-extracted-date">{file.extractedData.date || 'Not detected'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground">Property:</span>
                <span data-testid="text-extracted-property">{file.extractedData.propertyName || 'Not detected'}</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
