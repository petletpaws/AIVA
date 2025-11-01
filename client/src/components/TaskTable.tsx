import React, { useState, useMemo } from 'react';
import { ChevronUpIcon, ChevronDownIcon, SearchIcon, FilterIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Task {
  TaskID: string | number;
  TaskName: string;
  TaskDescription: string | null;
  CompleteConfirmedDate: string | null;
  Property?: {
    PropertyAbbreviation?: string;
  };
  Staff?: Array<{
    Name: string;
  }>;
}

interface TaskTableProps {
  tasks: Task[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

type SortField = 'TaskID' | 'TaskName' | 'CompleteConfirmedDate' | 'PropertyAbbreviation';
type SortDirection = 'asc' | 'desc';

export default function TaskTable({ tasks, isLoading = false, onRefresh }: TaskTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('TaskID');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'incomplete'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      const matchesSearch = 
        task.TaskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.TaskDescription?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (task.Property?.PropertyAbbreviation?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (task.Staff?.some(s => s.Name.toLowerCase().includes(searchTerm.toLowerCase())) || false);
      
      const matchesStatus = 
        filterStatus === 'all' ||
        (filterStatus === 'completed' && task.CompleteConfirmedDate) ||
        (filterStatus === 'incomplete' && !task.CompleteConfirmedDate);
      
      return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'TaskID':
          aValue = String(a.TaskID);
          bValue = String(b.TaskID);
          break;
        case 'TaskName':
          aValue = a.TaskName;
          bValue = b.TaskName;
          break;
        case 'CompleteConfirmedDate':
          aValue = a.CompleteConfirmedDate || '';
          bValue = b.CompleteConfirmedDate || '';
          break;
        case 'PropertyAbbreviation':
          aValue = a.Property?.PropertyAbbreviation || '';
          bValue = b.Property?.PropertyAbbreviation || '';
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [tasks, searchTerm, sortField, sortDirection, filterStatus]);

  const totalPages = Math.ceil(filteredAndSortedTasks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTasks = filteredAndSortedTasks.slice(startIndex, endIndex);

  // Group paginated tasks by staff name
  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    
    paginatedTasks.forEach(task => {
      const staffNames = (task.Staff && task.Staff.length > 0) 
        ? task.Staff.map(s => s.Name).join(', ') 
        : 'Unassigned';
      if (!groups[staffNames]) {
        groups[staffNames] = [];
      }
      groups[staffNames].push(task);
    });
    
    return groups;
  }, [paginatedTasks]);

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="h-auto p-0 font-semibold hover-elevate"
      data-testid={`button-sort-${field.toLowerCase()}`}
    >
      <span className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? 
            <ChevronUpIcon className="h-3 w-3" /> : 
            <ChevronDownIcon className="h-3 w-3" />
        )}
      </span>
    </Button>
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center flex-wrap">
            <div className="relative flex-1 min-w-64">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks, descriptions, properties, or staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-tasks"
              />
            </div>
            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger className="w-40" data-testid="select-filter-status">
                <FilterIcon className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tasks</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="incomplete">Incomplete</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks ({filteredAndSortedTasks.length} total)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {Object.keys(groupedTasks).length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">No tasks found matching your criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4">
                      <SortButton field="TaskID">Task ID</SortButton>
                    </th>
                    <th className="text-left p-4">
                      <SortButton field="TaskName">Task Name</SortButton>
                    </th>
                    <th className="text-left p-4">Description</th>
                    <th className="text-left p-4">
                      <SortButton field="PropertyAbbreviation">Property</SortButton>
                    </th>
                    <th className="text-left p-4">
                      <SortButton field="CompleteConfirmedDate">Status</SortButton>
                    </th>
                    <th className="text-left p-4">Completed Date</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedTasks).map(([staffName, staffTasks]) => (
                    <React.Fragment key={staffName}>
                      {/* Staff Group Header */}
                      <tr className="bg-accent/30 border-b">
                        <td colSpan={6} className="p-4">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-medium">
                              {staffName}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              ({staffTasks.length} tasks)
                            </span>
                          </div>
                        </td>
                      </tr>
                      {/* Tasks for this staff */}
                      {staffTasks.map((task) => (
                        <tr 
                          key={task.TaskID} 
                          className="border-b hover-elevate"
                          data-testid={`row-task-${task.TaskID}`}
                        >
                          <td className="p-4 font-mono text-sm">{task.TaskID}</td>
                          <td className="p-4 font-medium">{task.TaskName}</td>
                          <td className="p-4 text-sm text-muted-foreground max-w-xs truncate">
                            {task.TaskDescription || "—"}
                          </td>
                          <td className="p-4">
                            {task.Property?.PropertyAbbreviation ? (
                              <Badge variant="outline">{task.Property.PropertyAbbreviation}</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-4">
                            <Badge 
                              variant={task.CompleteConfirmedDate ? "default" : "secondary"}
                              data-testid={`status-task-${task.TaskID}`}
                            >
                              {task.CompleteConfirmedDate ? "Completed" : "Incomplete"}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {task.CompleteConfirmedDate || "—"}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredAndSortedTasks.length)} of {filteredAndSortedTasks.length} results
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Export the Task interface for use in other components
export type { Task };