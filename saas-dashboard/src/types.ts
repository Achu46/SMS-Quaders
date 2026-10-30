export type NavItemId =
  | 'Emails'
  | 'Templates'
  | 'Audience'
  | 'Inboxes'
  | 'Broadcasts'
  | 'Automations'
  | 'Metrics'
  | 'Domains'
  | 'Logs'
  | 'API keys'
  | 'Webhooks'

export interface NavItemConfig {
  id: NavItemId
  label: string
  groupId: number
  badge?: string
}

export interface NavGroup {
  id: number
  title?: string
  items: NavItemConfig[]
}
