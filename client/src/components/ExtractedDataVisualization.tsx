import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, DollarSign, User, Mail, Phone, MapPin, Grid3x3 } from 'lucide-react';
import type { ExtractedInvoiceData } from '@shared/schema';

interface ExtractedDataVisualizationProps {
  data: ExtractedInvoiceData;
}

const getConfidenceBadgeVariant = (confidence: number): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (confidence >= 90) return 'default';
  if (confidence >= 70) return 'secondary';
  return 'outline';
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 90) return 'text-green-600 dark:text-green-400';
  if (confidence >= 70) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

export default function ExtractedDataVisualization({ data }: ExtractedDataVisualizationProps) {
  const allData = data.allExtractedData;
  
  if (!allData) {
    return null;
  }

  const hasAnyData = (allData.dates && allData.dates.length > 0) ||
    (allData.amounts && allData.amounts.length > 0) ||
    (allData.names && allData.names.length > 0) ||
    (allData.emails && allData.emails.length > 0) ||
    (allData.phoneNumbers && allData.phoneNumbers.length > 0) ||
    (allData.addresses && allData.addresses.length > 0);

  if (!hasAnyData) {
    return null;
  }

  return (
    <div className="w-full">
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="all" className="text-xs sm:text-sm">
            <Grid3x3 className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">All</span>
          </TabsTrigger>
          {allData.dates && allData.dates.length > 0 && (
            <TabsTrigger value="dates" className="text-xs sm:text-sm">
              <Calendar className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Dates</span>
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {allData.dates.length}
              </Badge>
            </TabsTrigger>
          )}
          {allData.amounts && allData.amounts.length > 0 && (
            <TabsTrigger value="amounts" className="text-xs sm:text-sm">
              <DollarSign className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Amounts</span>
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {allData.amounts.length}
              </Badge>
            </TabsTrigger>
          )}
          {allData.names && allData.names.length > 0 && (
            <TabsTrigger value="names" className="text-xs sm:text-sm">
              <User className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Names</span>
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {allData.names.length}
              </Badge>
            </TabsTrigger>
          )}
          {allData.emails && allData.emails.length > 0 && (
            <TabsTrigger value="emails" className="text-xs sm:text-sm">
              <Mail className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Emails</span>
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {allData.emails.length}
              </Badge>
            </TabsTrigger>
          )}
          {allData.phoneNumbers && allData.phoneNumbers.length > 0 && (
            <TabsTrigger value="phones" className="text-xs sm:text-sm">
              <Phone className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Phones</span>
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {allData.phoneNumbers.length}
              </Badge>
            </TabsTrigger>
          )}
          {allData.addresses && allData.addresses.length > 0 && (
            <TabsTrigger value="addresses" className="text-xs sm:text-sm">
              <MapPin className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Addresses</span>
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {allData.addresses.length}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-4">
          {allData.dates && allData.dates.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Dates ({allData.dates.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allData.dates.map((date, idx) => (
                    <div key={idx} className="p-2 rounded border bg-muted/50 flex justify-between items-start gap-2">
                      <div>
                        <p className="font-mono text-sm">{date.isoDate}</p>
                        <p className="text-xs text-muted-foreground">{date.dateStr}</p>
                      </div>
                      <Badge variant={getConfidenceBadgeVariant(date.confidence)} className="text-xs shrink-0">
                        {date.confidence}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {allData.amounts && allData.amounts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Amounts ({allData.amounts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allData.amounts.map((amt, idx) => (
                    <div key={idx} className="p-2 rounded border bg-muted/50 flex justify-between items-start gap-2">
                      <div>
                        <p className="font-mono text-sm font-semibold">${amt.amount.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{amt.original}</p>
                      </div>
                      <Badge variant={getConfidenceBadgeVariant(amt.confidence)} className="text-xs shrink-0">
                        {amt.confidence}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {allData.names && allData.names.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Names ({allData.names.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allData.names.map((name, idx) => (
                    <div key={idx} className="p-2 rounded border bg-muted/50 flex justify-between items-start gap-2">
                      <div>
                        <p className="font-medium text-sm">{name.name}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {name.type}
                        </Badge>
                      </div>
                      <Badge variant={getConfidenceBadgeVariant(name.confidence)} className="text-xs shrink-0">
                        {name.confidence}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {allData.emails && allData.emails.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Emails ({allData.emails.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allData.emails.map((email, idx) => (
                    <div key={idx} className="p-2 rounded border bg-muted/50 flex justify-between items-start gap-2">
                      <div>
                        <p className="font-mono text-sm break-all">{email.email}</p>
                      </div>
                      <Badge variant={getConfidenceBadgeVariant(email.confidence)} className="text-xs shrink-0">
                        {email.confidence}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {allData.phoneNumbers && allData.phoneNumbers.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Numbers ({allData.phoneNumbers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allData.phoneNumbers.map((phone, idx) => (
                    <div key={idx} className="p-2 rounded border bg-muted/50 flex justify-between items-start gap-2">
                      <div>
                        <p className="font-mono text-sm">{phone.number}</p>
                      </div>
                      <Badge variant={getConfidenceBadgeVariant(phone.confidence)} className="text-xs shrink-0">
                        {phone.confidence}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {allData.addresses && allData.addresses.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Addresses ({allData.addresses.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {allData.addresses.map((addr, idx) => (
                    <div key={idx} className="p-2 rounded border bg-muted/50 flex justify-between items-start gap-2">
                      <div>
                        <p className="text-sm">{addr.address}</p>
                      </div>
                      <Badge variant={getConfidenceBadgeVariant(addr.confidence)} className="text-xs shrink-0">
                        {addr.confidence}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {allData.dates && allData.dates.length > 0 && (
          <TabsContent value="dates" className="space-y-3 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Found Dates</CardTitle>
                <CardDescription>All dates detected in the document with confidence scores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {allData.dates.map((date, idx) => (
                    <div key={idx} className="p-3 rounded-lg border bg-card flex justify-between items-start gap-3">
                      <div>
                        <p className="font-mono font-semibold">{date.isoDate}</p>
                        <p className="text-sm text-muted-foreground">{date.dateStr}</p>
                      </div>
                      <Badge variant={getConfidenceBadgeVariant(date.confidence)}>
                        {date.confidence}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {allData.amounts && allData.amounts.length > 0 && (
          <TabsContent value="amounts" className="space-y-3 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Found Amounts</CardTitle>
                <CardDescription>All monetary values detected with confidence scores</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {allData.amounts.map((amt, idx) => (
                    <div key={idx} className="p-3 rounded-lg border bg-card flex justify-between items-start gap-3">
                      <div>
                        <p className="font-mono font-semibold">${amt.amount.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">{amt.original}</p>
                      </div>
                      <Badge variant={getConfidenceBadgeVariant(amt.confidence)}>
                        {amt.confidence}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {allData.names && allData.names.length > 0 && (
          <TabsContent value="names" className="space-y-3 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Found Names</CardTitle>
                <CardDescription>All person/property names detected in the document</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {allData.names.map((name, idx) => (
                    <div key={idx} className="p-3 rounded-lg border bg-card flex justify-between items-start gap-3">
                      <div>
                        <p className="font-medium">{name.name}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {name.type}
                        </Badge>
                      </div>
                      <Badge variant={getConfidenceBadgeVariant(name.confidence)}>
                        {name.confidence}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {allData.emails && allData.emails.length > 0 && (
          <TabsContent value="emails" className="space-y-3 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Found Emails</CardTitle>
                <CardDescription>All email addresses detected in the document</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {allData.emails.map((email, idx) => (
                    <div key={idx} className="p-3 rounded-lg border bg-card flex justify-between items-start gap-3">
                      <p className="font-mono text-sm break-all">{email.email}</p>
                      <Badge variant={getConfidenceBadgeVariant(email.confidence)}>
                        {email.confidence}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {allData.phoneNumbers && allData.phoneNumbers.length > 0 && (
          <TabsContent value="phones" className="space-y-3 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Found Phone Numbers</CardTitle>
                <CardDescription>All phone numbers detected in the document</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {allData.phoneNumbers.map((phone, idx) => (
                    <div key={idx} className="p-3 rounded-lg border bg-card flex justify-between items-start gap-3">
                      <p className="font-mono text-sm">{phone.number}</p>
                      <Badge variant={getConfidenceBadgeVariant(phone.confidence)}>
                        {phone.confidence}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {allData.addresses && allData.addresses.length > 0 && (
          <TabsContent value="addresses" className="space-y-3 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Found Addresses</CardTitle>
                <CardDescription>All addresses detected in the document</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {allData.addresses.map((addr, idx) => (
                    <div key={idx} className="p-3 rounded-lg border bg-card flex justify-between items-start gap-3">
                      <p className="text-sm">{addr.address}</p>
                      <Badge variant={getConfidenceBadgeVariant(addr.confidence)}>
                        {addr.confidence}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
