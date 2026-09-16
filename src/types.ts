export type Role = "SUPER_ADMIN" | "USER_ADMIN" | "MICRON_STAFF" | "CONTRACTOR_REQUESTOR" | "CONTRACTOR_PM" | "ASSESSOR" | (string & {});
export interface User { id: string; name: string; email: string; role: Role; group?: string; authMethod?: "SSO" | "PASSWORD"; company?: string; sites?: string[] }
export type PermitType = "GENERAL" | "HOT_WORK";
export type PermitStatus = "DRAFT" | "INDIVIDUAL_REVIEW" | "MT_REVIEW" | "PM_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "CLOSURE_REQUESTED" | "CLOSED" | "REJECTED" | "CANCELLED" | "EXPIRED" | "SUPERSEDED";
export type ApprovalRole = "INDIVIDUAL_REVIEWER" | "MT_GROUP" | "PM";
export interface ApprovalStage { role: ApprovalRole; status: "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED"; actorId?: string; actedAt?: string; comment?: string }
export interface AttachmentMetadata { id: string; name: string; type: string; size: number }
export interface HotWorkDetails { fireWatchName: string; fireWatchMobile: string; gasTestingRequired: boolean; combustibleMaterialsRemoved: boolean; extinguishersAvailable: boolean }
export type SafetyChecklistResponse = Record<string, string | boolean>;
export type SafetyChecklistResponses = Record<string, SafetyChecklistResponse>;
export interface PermitFormData {
  templateId?: string; templateName?: string;
  customFields?: Record<string, string | boolean>;
  title: string; description: string; site: string; discipline: string; location: string; company: string; startAt: string; endAt: string;
  hostId: string; individualReviewerId: string; individualReviewerIds?: string[]; mtGroup: string; mtGroups?: string[]; hazards: string[]; safetyDeclarations: string[];
  assessorIds?: string[];
  attachments: AttachmentMetadata[]; hotWork?: HotWorkDetails; safetyChecklistResponses?: SafetyChecklistResponses;
}
export interface PermitRevision { id: string; number: number; status: PermitStatus; data: PermitFormData; approvals: ApprovalStage[]; createdAt: string; createdBy: string; submittedAt?: string }
export interface ActivityLog { id: string; date: string; summary: string; safetyConfirmed: boolean; actorId: string; createdAt: string }
export interface AuditEvent { id: string; at: string; actorId: string; actorRole: Role; revision: number; action: string; fromStatus?: PermitStatus; toStatus?: PermitStatus; comment?: string }
export interface Permit { id: string; permitNumber: string; type: PermitType; parentId?: string; childIds: string[]; requestorId: string; currentRevisionId: string; revisions: PermitRevision[]; activities: ActivityLog[]; audit: AuditEvent[] }
export type TransitionAction = "SUBMIT" | "APPROVE" | "REQUEST_CHANGES" | "REJECT" | "CANCEL" | "ACTIVATE" | "SUSPEND" | "RESUME" | "REQUEST_CLOSURE" | "CLOSE";
export interface TransitionPayload { comment?: string }
export interface PermitFilters { query?: string; status?: PermitStatus | ""; type?: PermitType | ""; site?: string; discipline?: string }
export interface EptwState { version: number; permits: Permit[] }
export const currentRevision = (permit: Permit) => permit.revisions.find((revision) => revision.id === permit.currentRevisionId)!;
