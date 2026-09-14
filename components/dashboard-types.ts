export type DashboardStudent = {
  id: string;
  projectId: string | null;
  name: string;
  nim: string;
  program: string;
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
  canAiReview: boolean;
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

export type DashboardReview = {
  id: string;
  documentName: string;
  studentName: string;
  mode: string;
  status: string;
  itemCount: number;
  createdAt: string;
};

export type DashboardAiSettings = {
  enabled: boolean;
  modelName: string;
  customInstructions: string;
  maxFindings: number;
  apiConfigured: boolean;
};
