export type DashboardStudent = {
  id: string;
  projectId: string | null;
  name: string;
  nim: string;
  program: string;
  whatsapp: string;
  cohort: number;
  className: string;
  supervisors: string[];
  stage: string;
  progress: number;
  status: string;
  updatedAt: string;
  archivedAt: string | null;
  consultationCount: number;
  consultationTopics: string[];
  proposalEligibility: string;
  resultEligibility: string;
};

export type DashboardDocument = {
  id: string;
  studentName: string;
  category: string;
  name: string;
  version: number;
  status: string;
  sizeBytes: number;
  createdAt: string;
  uploaderName: string;
  uploaderRole: string;
};

export type DashboardMessage = {
  id: string;
  senderName: string;
  senderRole: string;
  body: string;
  createdAt: string;
};

export type DashboardConsultation = {
  id: string;
  studentName: string;
  subject: string;
  status: string;
  updatedAt: string;
  messages: DashboardMessage[];
};

export type DashboardAppointment = {
  id: string;
  topic: string;
  studentName: string;
  startsAt: string;
  method: string;
  decision: string;
  meetingUrl: string | null;
};

export type DashboardTitle = {
  id: string;
  studentName: string;
  studentId: string;
  sequence: number;
  title: string;
  background: string;
  researchProblem: string;
  objective: string;
  proposedMethod: string | null;
  initialReferences: string | null;
  decision: string;
  decisionReason: string | null;
  createdAt: string;
};

export type DashboardLogbook = {
  id: string;
  studentName: string;
  entryDate: string;
  topic: string;
  summary: string;
  feedbackReceived: string | null;
  actionItems: string[];
  nextMeetingTarget: string | null;
  meetingType: string;
  isVerified: boolean;
};

export type DashboardProgress = {
  id: number;
  name: string;
  weight: number;
  status: "APPROVED" | "IN_PROGRESS" | "NOT_STARTED";
};

export type DashboardNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  targetUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export type DashboardBookingSlot = {
  id: string;
  lecturerName: string;
  startsAt: string;
  endsAt: string;
  method: string;
  locationOrUrl: string | null;
  quota: number;
  booked: number;
  myBookingId: string | null;
  myBookingStatus: string | null;
};

export type DashboardBookingRequest = {
  id: string;
  studentName: string;
  studentId: string;
  topic: string;
  note: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  method: string;
  locationOrUrl: string | null;
  createdAt: string;
};

export type DashboardStage = {
  id: number;
  name: string;
  weight: number;
};

export type DashboardCommentTemplate = {
  id: string;
  category: string;
  title: string;
  content: string;
  ownerName: string;
  updatedAt: string;
};

export type DashboardSuratTemplate = {
  id: string;
  name: string;
  documentType: string;
  bodyTemplate: string;
  isActive: boolean;
};

export type DashboardSuratRequest = {
  id: string;
  studentName: string;
  studentId: string;
  templateName: string | null;
  documentType: string | null;
  purpose: string;
  status: string;
  reviewerNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type DashboardPeriod = {
  id: string;
  name: string;
  semester: number;
  academicYear: string | null;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
  isLocked: boolean;
};

export type DashboardAudit = {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};
