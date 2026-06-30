export type {
  EventApproval,
  ApprovalDecisionCode,
  CreateEventApprovalInput,
  CounterProposalInput,
} from './types/event-approval.types'
export { APPROVAL_DECISION_IDS } from './types/event-approval.types'

export {
  eventApprovalsService,
  approveEvent,
  proposeCounterDate,
  rejectEvent,
  getLatestApproval,
} from './api/event-approvals.service'

export { useEventApproval } from './hooks/useEventApproval'
export { useLatestApproval } from './hooks/useLatestApproval'
