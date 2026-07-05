export interface WriterSourceRef {
  name: string
  url: string
}

export interface WriterStepOutput {
  title: string
  titleCandidates: string[]
  summary: string
  bodyMarkdown: string
  sources: WriterSourceRef[]
}

export interface WriterDraftFields {
  title: string
  summary: string
  bodyMarkdown: string
}
