import { EmailItem } from "./types"

export const emails: EmailItem[] = [
  {
    id: "1",
    sender: "John Doe",
    senderEmail: "john.doe@company.com",
    subject: "Project Update - Q4 Planning",
    preview: "Hi team, I wanted to share the latest updates on our Q4 planning initiative...",
    content: `Hi team,

I wanted to share the latest updates on our Q4 planning initiative. We've made significant progress across all departments and I'm excited to share the key highlights with you.

**Key Achievements:**
• Completed market research analysis
• Finalized budget allocations for next quarter
• Established new partnership agreements
• Launched the beta version of our new product line

**Next Steps:**
1. Review and approve final budget proposals
2. Schedule team meetings for project kickoffs
3. Begin implementation of new processes
4. Monitor progress and adjust timelines as needed

Please review the attached documents and let me know if you have any questions or concerns. I'd like to schedule a team meeting next week to discuss these updates in detail.

Best regards,
John Doe
Project Manager`,
    time: "2:30 PM",
    date: "Today",
    unread: true,
    starred: false,
  },
  {
    id: "2",
    sender: "Sarah Wilson",
    senderEmail: "sarah.wilson@company.com",
    subject: "Meeting Notes from Today's Call",
    preview: "Thanks everyone for joining today's call. Here are the key takeaways...",
    content: `Hi everyone,

Thanks for joining today's call. Here are the key takeaways and action items from our discussion:

**Meeting Summary:**
- Discussed Q4 marketing strategy
- Reviewed current campaign performance
- Planned upcoming product launches
- Addressed team resource allocation

**Action Items:**
• Sarah: Update campaign metrics dashboard by Friday
• Mike: Prepare product launch timeline
• Lisa: Coordinate with design team for new assets
• Team: Review and provide feedback on strategy document

The next meeting is scheduled for next Tuesday at 2 PM. Please come prepared with your department updates.

Thanks,
Sarah Wilson
Marketing Director`,
    time: "1:15 PM",
    date: "Today",
    unread: true,
    starred: true,
  },
  {
    id: "3",
    sender: "Marketing Team",
    senderEmail: "marketing@company.com",
    subject: "New Campaign Launch Results",
    preview: "The results are in! Our latest campaign has exceeded expectations...",
    content: `Team,

The results are in! Our latest campaign has exceeded expectations and I'm thrilled to share the outstanding performance metrics with you.

**Campaign Performance:**
• 150% increase in engagement rates
• 200% boost in conversion rates
• 85% improvement in brand awareness
• $2.5M in additional revenue generated

**Key Success Factors:**
- Targeted audience segmentation
- Compelling creative content
- Strategic timing and placement
- Cross-platform integration

This success validates our new approach and sets a strong foundation for future campaigns. Congratulations to everyone who contributed to this achievement!

Best regards,
Marketing Team`,
    time: "11:45 AM",
    date: "Today",
    unread: false,
    starred: false,
  },
  {
    id: "4",
    sender: "IT Support",
    senderEmail: "support@company.com",
    subject: "System Maintenance Scheduled",
    preview: "Please be aware that we have scheduled system maintenance for this weekend...",
    content: `Dear Team,

Please be aware that we have scheduled system maintenance for this weekend to improve performance and security.

**Maintenance Details:**
• Date: Saturday, December 16th
• Time: 11:00 PM - 3:00 EST
• Duration: Approximately 4 hours
• Systems Affected: Email, CRM, and file servers

**What to Expect:**
- Brief service interruptions
- Temporary inability to access certain systems
- Temporary inability to access certain systems
- Improved performance after completion

We apologize for any inconvenience and appreciate your patience during this maintenance window.

IT Support Team`,
    time: "10:20 AM",
    date: "Today",
    unread: false,
    starred: false,
  },
]
