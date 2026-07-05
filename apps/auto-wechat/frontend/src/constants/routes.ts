export const ROUTE_NAMES = {
  LOGIN: 'Login',
  PIPELINE_TRIGGER: 'PipelineTrigger',
  RUN_DETAIL: 'RunDetail',
  RUN_EDITOR: 'RunEditor',
  DRAFT_PREVIEW: 'DraftPreview',
  LAYOUT_TEMPLATES: 'LayoutTemplates',
  LAYOUT_TEMPLATE_DETAIL: 'LayoutTemplateDetail',
  IMAGE_LIBRARY: 'ImageLibrary',
} as const

export type RouteName = (typeof ROUTE_NAMES)[keyof typeof ROUTE_NAMES]
