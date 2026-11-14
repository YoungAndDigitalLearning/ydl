const { chromium } = require("playwright")
const fs = require("fs")
const path = require("path")
const readline = require("readline")

const BASE_URL = process.env.YDL_URL || "http://127.0.0.1:8080"
const OUTPUT_DIR = path.join(__dirname, "output")
const PROFILE_BASE = path.join(__dirname, ".browser-profiles")

const DESKTOP = { width: 1920, height: 1080 }
const MOBILE = { width: 430, height: 932 }

const routes = {
  student: [
    { name: "01-landing", path: "/", public: true, text: "Announcements" },
    { name: "02-dashboard", path: "/profile/2/courses/", text: "Joined Courses" },
    { name: "03-settings", path: "/profile/2/settings/" },
    { name: "04-all-courses", path: "/profile/2/allcourses", text: "All Courses" },
    { name: "05-german-course", path: "/profile/2/courses/1", text: "German Conversation A2" },
    { name: "06-spanish-course", path: "/profile/2/courses/2", text: "Introduction to Spanish" },
    { name: "07-forum", path: "/profile/2/courses/forum", text: "Course Forum" },
    { name: "08-forum-thread", path: "/profile/2/courses/forum/post/3", text: "Preparing for our next speaking session" },
    { name: "09-calendar", path: "/profile/2/calendar/", text: "Calendar" },
    { name: "10-quiz", path: "/profile/2/courses/1/quiz", text: "QUIZ" }
  ],
  teacher: [
    { name: "01-dashboard", path: "/profile/1/courses/" },
    { name: "02-german-course", path: "/profile/1/courses/1", text: "German Conversation A2" },
    { name: "03-edit-course", path: "/profile/1/courses/1/edit" },
    { name: "04-edit-quiz", path: "/profile/1/courses/1/quiz/edit" },
    { name: "05-create-resource", path: "/profile/1/createresource" },
    { name: "06-create-course", path: "/profile/1/createcourse" }
  ],
  mobile: [
    { name: "01-german-course", path: "/profile/2/courses/1", text: "German Conversation A2" },
    { name: "02-german-quiz", path: "/profile/2/courses/1/quiz", text: "QUIZ" }
  ]
}

function url (route) {
  return `${BASE_URL}/#${route}`
}

function waitEnter (message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(`${message}\n`, () => {
    rl.close()
    resolve()
  }))
}

function profilePath (role) {
  return path.join(PROFILE_BASE, role)
}

async function launchProfile (role, viewport) {
  return chromium.launchPersistentContext(profilePath(role), {
    headless: false,
    viewport,
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "en-US"
  })
}

async function settle (page) {
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready
  })
  // Old Vue + Webpack dev server may keep network connections open.
  await page.waitForTimeout(1200)
}

async function gotoRoute (page, entry, role) {
  console.log(`Opening ${role}/${entry.name}: ${url(entry.path)}`)
  await page.goto(url(entry.path), { waitUntil: "domcontentloaded", timeout: 30000 })

  // Detect redirects to /login before taking an irrelevant screenshot.
  await page.waitForTimeout(500)
  if (!entry.public && page.url().includes("#/login")) {
    throw new Error(`Redirected to login. Run: pnpm capture:login:${role}`)
  }

  if (entry.text) {
    await page.getByText(entry.text, { exact: false }).first().waitFor({
      state: "visible", timeout: 15000
    })
  } else {
    await page.locator("#app").waitFor({ state: "visible", timeout: 15000 })
  }
  await settle(page)

  const requested = `#${entry.path}`.replace(/\/$/, "")
  const actual = new URL(page.url()).hash.replace(/\/$/, "")
  if (requested !== actual) throw new Error(`Unexpected route: ${page.url()}`)
  if (!entry.public && page.url().includes("#/login")) throw new Error("Session expired")
}

async function take (page, role, name) {
  const folder = path.join(OUTPUT_DIR, role)
  fs.mkdirSync(folder, { recursive: true })
  const filename = path.join(folder, `${name}.png`)
  await page.screenshot({ path: filename, fullPage: false, animations: "disabled", caret: "hide" })
  console.log(`Saved: ${filename}`)
}

async function publicLanding () {
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({
      viewport: DESKTOP, deviceScaleFactor: 1, locale: "en-US",
      colorScheme: "light", reducedMotion: "reduce"
    })
    const page = await context.newPage()
    await gotoRoute(page, routes.student[0], "student")
    await take(page, "student", routes.student[0].name)
    await context.close()
  } finally {
    await browser.close()
  }
}

async function login (role) {
  const context = await launchProfile(role, DESKTOP)
  try {
    const page = context.pages()[0] || await context.newPage()
    await page.goto(url("/login"), { waitUntil: "domcontentloaded" })
    await waitEnter(`Log in as demo_${role} in Chromium, then press ENTER here.`)
    if (!await page.getByText(`demo_${role}`, { exact: false }).first().isVisible()) {
      throw new Error(`Could not confirm demo_${role} login. Check the navbar before closing.`)
    }
    console.log(`Stored local session for ${role}.`)
  } finally {
    await context.close()
  }
}

async function runGroup (group, onlyName) {
  const role = group === "teacher" ? "teacher" : "student"
  const viewport = group === "mobile" ? MOBILE : DESKTOP
  const entries = routes[group].filter(item => !onlyName || item.name === onlyName)
  if (!entries.length) throw new Error(`Unknown screenshot name: ${onlyName}`)

  if (group === "student" && entries.some(item => item.public)) await publicLanding()
  const privateEntries = entries.filter(item => !item.public)
  if (!privateEntries.length) return

  const context = await launchProfile(role, viewport)
  try {
    const page = context.pages()[0] || await context.newPage()
    let failures = 0
    for (const entry of privateEntries) {
      try {
        await gotoRoute(page, entry, role)
        await take(page, group, entry.name)
      } catch (error) {
        failures += 1
        console.error(`FAILED ${group}/${entry.name}: ${error.message}`)
      }
    }
    if (failures) process.exitCode = 1
  } finally {
    await context.close()
  }
}

async function manual (role, name) {
  const context = await launchProfile(role, DESKTOP)
  try {
    const page = context.pages()[0] || await context.newPage()
    await page.goto(url("/"))
    await waitEnter("Navigate and prepare the view (e.g. submit a quiz), then press ENTER.")
    await settle(page)
    await take(page, role, name || "manual")
  } finally {
    await context.close()
  }
}

async function main () {
  const command = process.argv[2] || "student"
  const arg = process.argv[3]

  if (command === "list") {
    Object.keys(routes).forEach(group => {
      console.log(`\n${group}:`)
      routes[group].forEach(item => console.log(`  ${item.name}  ${url(item.path)}`))
    })
    return
  }

  if (command === "login:student" || command === "login:teacher") {
    await login(command.split(":")[1])
  } else if (["student", "teacher", "mobile"].includes(command)) {
    await runGroup(command, arg)
  } else if (command === "all") {
    for (const group of ["student", "teacher", "mobile"]) await runGroup(group)
  } else if (command === "manual") {
    await manual(arg === "teacher" ? "teacher" : "student", process.argv[4])
  } else {
    throw new Error("Usage: node capture.cjs list|login:student|login:teacher|student|teacher|mobile|all|manual [role] [name]")
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
