/**
 * DSA Editor Container - Wrapper for DSA coding questions
 * Re-exports the existing EditorContainer from dsa/test for use in AI assessments
 */

'use client'

// Re-export the existing EditorContainer - no need to duplicate code
export { EditorContainer } from '../../dsa/test/EditorContainer'
export type { SubmissionTestcaseResult, SubmissionHistoryEntry } from '../../dsa/test/EditorContainer'


