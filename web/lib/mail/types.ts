export interface EmailItem {
  id: number
  sender: string
  senderEmail: string
  subject: string
  preview: string
  content: string
  time: string
  date: string
  unread: boolean
  starred: boolean
}
