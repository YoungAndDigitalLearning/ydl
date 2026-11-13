
const { chromium } = require("playwright")
const fs = require("fs")
const path = require("path")
const readline = require("readline")

const BASE_URL = "http://127.0.0.1:8080"
const USER_ID = 2

const OUTPUT_DIR = path.join(__dirname, "output")
const PROFILE_DIR = path.join(__dirname, ".browser-profile")

const VIEWPORT = {
  width: 1920,
  height: 1080
}

const pages = [
  {
    name: "01-landing",
    route: "/",
    public: true,
    expectedText: "Announcements"
  },
  {
    name: "02-dashboard",
    route: `/profile/${USER_ID}/courses/`,
    expectedText: "Joined Courses"
  },
  {
    name: "03-settings",
    route: `/profile/${USER_ID}/settings/`
  },
  {
    name: "04-all-courses",
    route: `/profile/${USER_ID}/allcourses`,
    expectedText: "All Courses"
  },
  {
    name: "05-german-course",
    route: `/profile/${USER_ID}/courses/1`,
    expectedText: "German Conversation A2"
  },
  {
    name: "06-spanish-course",
    route: `/profile/${USER_ID}/courses/2`,
    expectedText: "Introduction to Spanish"
  },
  {
    name: "07-forum",
    route: `/profile/${USER_ID}/courses/forum`,
    expectedText: "Course Forum"
  },
  {
    name: "08-forum-thread",
    route: `/profile/${USER_ID}/courses/forum/post/3`,
    expectedText: "Preparing for our next speaking session"
  },
  {
    name: "09-calendar",
    route: `/profile/${USER_ID}/calendar/`,
    expectedText: "Calendar"
  },
  {
    name: "10-quiz",
    route: `/profile/${USER_ID}/courses/1/quiz`,
    expectedText: "QUIZ"
  }
]

function pageUrl (route) {
  return `${BASE_URL}/#${route}`
}

function askForEnter (message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise(resolve => {
    rl.question(message + "\n", () => {
      rl.close()
      resolve()
    })
  })
}

function outputPath (name) {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "-")
  return path.join(OUTPUT_DIR, safeName + ".png")
}

async function capture (page, name) {
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready
    }
  })

  await page.screenshot({
    path: outputPath(name),
    fullPage: false,
    animations: "disabled",
    caret: "hide"
  })

  console.log("Saved:", outputPath(name))
}

async function openRoute (page, item) {
  const url = pageUrl(item.route)

  console.log(`Opening ${item.name}: ${url}`)

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  })

  // Wait for Vue to render the requested route.
  await page.waitForFunction(
    expectedRoute => {
      return window.location.hash.replace(/\/$/, "") ===
        ("#" + expectedRoute).replace(/\/$/, "")
    },
    item.route,
    { timeout: 15000 }
  )

  if (item.expectedText) {
    await page.getByText(item.expectedText, {
      exact: false
    }).first().waitFor({
      state: "visible",
      timeout: 15000
    })
  }

  // Allow asynchronous API data and layout to settle.
  await page.waitForTimeout(1000)

  if (!item.public && page.url().includes("#/login")) {
    throw new Error(
      "Not authenticated. Run: pnpm capture:login"
    )
  }

  if (item.expectedText) {
    const visible = await page.getByText(
      item.expectedText,
      { exact: false }
    ).first().isVisible()

    if (!visible) {
      throw new Error(
        `Expected content not visible: ${item.expectedText}`
      )
    }
  }
}

async function createContext () {
  return chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: VIEWPORT,
    screen: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "en-US"
  })
}

async function capturePublicLanding () {
  // A separate temporary browser profile keeps the
  // landing-page screenshot in its logged-out state.
  const browser = await chromium.launch({
    headless: true
  })

  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      locale: "en-US",
      reducedMotion: "reduce"
    })

    const page = await context.newPage()
    const item = pages[0]

    await openRoute(page, item)
    await capture(page, item.name)

    await context.close()
  } finally {
    await browser.close()
  }
}

async function main () {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const command = process.argv[2] || "all"

  if (command === "list") {
    pages.forEach(item => {
      console.log(item.name, pageUrl(item.route))
    })
    return
  }

  if (command === "all") {
    await capturePublicLanding()
  }

  const context = await createContext()

  try {
    const page = context.pages()[0] ||
      await context.newPage()

    if (command === "login") {
      await page.goto(pageUrl("/login"))

      console.log("Log in as demo_student.")

      await askForEnter(
        "After successful login, press ENTER to close Chromium."
      )

      console.log("Browser profile saved.")
      return
    }

    if (command === "manual") {
      const name = process.argv[3] || "manual"

      await page.goto(pageUrl("/"))

      await askForEnter(
        "Navigate to the desired page, then press ENTER."
      )

      await capture(page, name)
      return
    }

    const selected = command === "all"
      ? pages.filter(item => !item.public)
      : pages.filter(item => item.name === command)

    if (selected.length === 0) {
      throw new Error(
        "Unknown screenshot name. Run: node capture.cjs list"
      )
    }

    for (const item of selected) {
      try {
        if (item.public) {
          await capturePublicLanding()
        } else {
          await openRoute(page, item)
          await capture(page, item.name)
        }
      } catch (error) {
        console.error(
          `FAILED ${item.name}: ${error.message}`
        )
        process.exitCode = 1
      }
    }
  } finally {
    await context.close()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
