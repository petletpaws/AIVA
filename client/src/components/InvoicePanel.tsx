import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { FileTextIcon, SendIcon, MailIcon, UserIcon, CalendarIcon, CheckCircle, AlertCircle, HelpCircle, Upload } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { Task } from './TaskTable';
import type { UploadedFile, MatchStatus } from '@shared/schema';

interface InvoicePanelProps {
  tasks: Task[];
}

interface StaffInvoice {
  staffName: string;
  staffEmail?: string;
  tasks: Task[];
  totalAmount: number;
  matchStatus?: MatchStatus;
  matchDetails?: string | null;
}

export default function InvoicePanel({ tasks }: InvoicePanelProps) {
  const { toast } = useToast();
  const [selectedInvoice, setSelectedInvoice] = useState<StaffInvoice | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedInvoice && !emailDialogOpen && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedInvoice, emailDialogOpen]);

  useEffect(() => {
    const fetchUploadedFiles = async () => {
      try {
        const response = await fetch('/api/files');
        if (response.ok) {
          const files = await response.json();
          setUploadedFiles(files);
        }
      } catch (error) {
        console.error('Failed to fetch uploaded files:', error);
      }
    };
    fetchUploadedFiles();
    const interval = setInterval(fetchUploadedFiles, 5000);
    return () => clearInterval(interval);
  }, []);

  const getMatchStatusForStaff = (staffName: string): { status?: MatchStatus; details?: string | null } => {
    const matchingFile = uploadedFiles.find(
      file => file.matchedStaffName?.toLowerCase() === staffName.toLowerCase()
    );
    if (matchingFile) {
      return { status: matchingFile.matchStatus, details: matchingFile.matchDetails };
    }
    return {};
  };

  const staffInvoices = useMemo(() => {
    const invoiceMap: Record<string, StaffInvoice> = {};

    tasks.forEach(task => {
      const staffMembers = task.Staff && task.Staff.length > 0 
        ? task.Staff 
        : [{ Name: 'Unassigned', Email: undefined }];

      staffMembers.forEach(staff => {
        const staffName = staff.Name;
        if (!invoiceMap[staffName]) {
          const matchInfo = getMatchStatusForStaff(staffName);
          invoiceMap[staffName] = {
            staffName,
            staffEmail: (staff as any).Email,
            tasks: [],
            totalAmount: 0,
            matchStatus: matchInfo.status,
            matchDetails: matchInfo.details,
          };
        }
        invoiceMap[staffName].tasks.push(task);
        invoiceMap[staffName].totalAmount += task.Amount ?? 0;
      });
    });

    return Object.values(invoiceMap).sort((a, b) => a.staffName.localeCompare(b.staffName));
  }, [tasks, uploadedFiles]);

  const getMatchStatusBadge = (status?: MatchStatus) => {
    if (!status) return null;
    
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
      default:
        return null;
    }
  };

  const handleOpenEmailDialog = (invoice: StaffInvoice) => {
    setSelectedInvoice(invoice);
    setRecipientEmail(invoice.staffEmail || '');
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!selectedInvoice || !recipientEmail) {
      toast({
        title: "Email Required",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          staffName: selectedInvoice.staffName,
          tasks: selectedInvoice.tasks,
          totalAmount: selectedInvoice.totalAmount,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Invoice Sent",
          description: `Invoice successfully sent to ${recipientEmail}`,
        });
        setEmailDialogOpen(false);
        setRecipientEmail('');
        setSelectedInvoice(null);
      } else {
        throw new Error(data.error || 'Failed to send invoice');
      }
    } catch (err: any) {
      toast({
        title: "Failed to Send",
        description: err.message || "Unable to send invoice email",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      const date = parseISO(dateStr.replace(' ', 'T'));
      return isNaN(date.getTime()) ? '—' : format(date, 'dd MMM yyyy');
    } catch {
      return '—';
    }
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileTextIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No tasks available to generate invoices.</p>
          <p className="text-sm text-muted-foreground mt-2">Load tasks first to create invoices for each staff member.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Staff Invoices
          </CardTitle>
          <CardDescription>
            Generate and send invoices grouped by staff member. Each invoice contains all tasks assigned to that person.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {staffInvoices.map((invoice) => (
              <Card key={invoice.staffName} className="overflow-visible">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <CardTitle className="text-base truncate">{invoice.staffName}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {getMatchStatusBadge(invoice.matchStatus)}
                      <Badge variant="secondary">
                        {invoice.tasks.length} tasks
                      </Badge>
                    </div>
                  </div>
                  {invoice.matchDetails && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      {invoice.matchDetails}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Amount:</span>
                      <span className="font-semibold text-lg">
                        ${invoice.totalAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {invoice.tasks.filter(t => t.CompleteConfirmedDate).length} completed, {invoice.tasks.filter(t => !t.CompleteConfirmedDate).length} pending
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-2 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => setSelectedInvoice(invoice)}
                    data-testid={`button-preview-invoice-${invoice.staffName.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <FileTextIcon className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleOpenEmailDialog(invoice)}
                    data-testid={`button-send-invoice-${invoice.staffName.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <SendIcon className="h-4 w-4 mr-1" />
                    Send
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedInvoice && !emailDialogOpen && (
        <Card ref={previewRef}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileTextIcon className="h-5 w-5" />
                  Invoice Preview
                </CardTitle>
                <CardDescription className="mt-1">
                  Invoice for {selectedInvoice.staffName}
                </CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedInvoice(null)}
                  data-testid="button-close-preview"
                >
                  Close Preview
                </Button>
                <Button 
                  onClick={() => handleOpenEmailDialog(selectedInvoice)}
                  data-testid="button-send-from-preview"
                >
                  <MailIcon className="h-4 w-4 mr-2" />
                  Send via Email
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md p-6 bg-card">
              <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-bold">INVOICE</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    <CalendarIcon className="h-3 w-3 inline mr-1" />
                    {format(new Date(), 'dd MMMM yyyy')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{selectedInvoice.staffName}</p>
                  {selectedInvoice.staffEmail && (
                    <p className="text-sm text-muted-foreground">{selectedInvoice.staffEmail}</p>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Task Name</th>
                      <th className="text-left py-2 font-medium">Property</th>
                      <th className="text-left py-2 font-medium">Status</th>
                      <th className="text-left py-2 font-medium">Completed</th>
                      <th className="text-right py-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.tasks.map((task) => (
                      <tr key={task.TaskID} className="border-b">
                        <td className="py-2">{task.TaskName}</td>
                        <td className="py-2">{task.Property?.PropertyAbbreviation || '—'}</td>
                        <td className="py-2">
                          <Badge 
                            variant={task.CompleteConfirmedDate ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {task.CompleteConfirmedDate ? "Done" : "Pending"}
                          </Badge>
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {formatDate(task.CompleteConfirmedDate)}
                        </td>
                        <td className="py-2 text-right font-medium">
                          {task.Amount != null ? `$${task.Amount.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold">
                      <td colSpan={4} className="py-4 text-right">Total:</td>
                      <td className="py-4 text-right text-lg">
                        ${selectedInvoice.totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MailIcon className="h-5 w-5" />
              Send Invoice via Email
            </DialogTitle>
            <DialogDescription>
              Send the invoice for {selectedInvoice?.staffName} to the specified email address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Recipient Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                data-testid="input-recipient-email"
              />
            </div>
            <div className="bg-muted/50 rounded-md p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Staff Member:</span>
                <span className="font-medium">{selectedInvoice?.staffName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Number of Tasks:</span>
                <span className="font-medium">{selectedInvoice?.tasks.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Amount:</span>
                <span className="font-semibold">${selectedInvoice?.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEmailDialogOpen(false)}
              data-testid="button-cancel-send"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmail}
              disabled={!recipientEmail || isSending}
              data-testid="button-confirm-send"
            >
              {isSending ? (
                <>Sending...</>
              ) : (
                <>
                  <SendIcon className="h-4 w-4 mr-2" />
                  Send Invoice
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
