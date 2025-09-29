import TaskTable, { Task } from '../TaskTable';

// todo: remove mock functionality
const mockTasks: Task[] = [
  {
    TaskID: "TSK-001",
    TaskName: "Room Cleaning - Premium Suite",
    TaskDescription: "Complete deep cleaning of premium suite including bathroom sanitization and amenity restocking",
    CompleteConfirmedDate: "2024-01-15T10:30:00Z",
    Property: {
      PropertyAbbreviation: "HTL-NYC"
    },
    Staff: [{ Name: "Sarah Johnson" }]
  },
  {
    TaskID: "TSK-002",
    TaskName: "Maintenance Check - HVAC System",
    TaskDescription: "Routine inspection and maintenance of HVAC system in lobby area",
    CompleteConfirmedDate: null,
    Property: {
      PropertyAbbreviation: "HTL-NYC"
    },
    Staff: [{ Name: "Mike Rodriguez" }]
  },
  {
    TaskID: "TSK-003",
    TaskName: "Guest Service - Concierge Request",
    TaskDescription: "Assist guest with restaurant reservations and transportation booking",
    CompleteConfirmedDate: "2024-01-15T14:45:00Z",
    Property: {
      PropertyAbbreviation: "HTL-LA"
    },
    Staff: [{ Name: "Emily Chen" }]
  },
  {
    TaskID: "TSK-004",
    TaskName: "Security Patrol - Night Shift",
    TaskDescription: "Complete security rounds of all floors and common areas",
    CompleteConfirmedDate: null,
    Property: {
      PropertyAbbreviation: "HTL-LA"
    },
    Staff: [{ Name: "Mike Rodriguez" }]
  },
  {
    TaskID: "TSK-005",
    TaskName: "Inventory Management - Housekeeping",
    TaskDescription: "Check and restock housekeeping supplies for all floors",
    CompleteConfirmedDate: null,
    Property: {
      PropertyAbbreviation: "HTL-SF"
    },
    Staff: [{ Name: "Sarah Johnson" }, { Name: "Emily Chen" }]
  },
  {
    TaskID: "TSK-006",
    TaskName: "Equipment Repair - Laundry",
    TaskDescription: "Fix malfunctioning washing machine in laundry facility",
    CompleteConfirmedDate: "2024-01-14T16:20:00Z",
    Property: {
      PropertyAbbreviation: "HTL-SF"
    },
    Staff: [{ Name: "Mike Rodriguez" }]
  }
];

export default function TaskTableExample() {
  return (
    <div className="p-6">
      <TaskTable tasks={mockTasks} />
    </div>
  );
}