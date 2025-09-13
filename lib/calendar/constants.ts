export const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export const eventColors = [
  { value: "primary", label: "Primary", class: "bg-primary text-primary-foreground" },
  { value: "secondary", label: "Secondary", class: "bg-secondary text-secondary-foreground" },
  { value: "success", label: "Success", class: "bg-green-600 text-white dark:bg-green-500" },
  { value: "warning", label: "Warning", class: "bg-yellow-600 text-white dark:bg-yellow-500" },
  { value: "danger", label: "Danger", class: "bg-red-600 text-white dark:bg-red-500" },
  { value: "info", label: "Info", class: "bg-blue-600 text-white dark:bg-blue-500" },
]

export const viewModes = [
  { value: "month" as const, label: "Month" },
  { value: "week" as const, label: "Week" },
  { value: "day" as const, label: "Day" },
]
