
const { chromium } = require("playwright")
const fs = require("fs")
const path = require("path")
const readline = require("readline")

async function main () {
  const name = process.argv[2] || "screenshot"
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "-")

  const outputDir = path.join(__dirname, "output")
  const profileDir = path.join(__dirname, ".browser-profile")

  fs.mkdirSync(outputDir, { recursive: true })

  const context = await chromium.launchPersistentContext(
    profileDir,
    {
      headless: false,
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      colorScheme: "light",
      reducedMotion: "reduce"
    }
  )

  const page = context.pages()[0] || await context.newPage()

  await page.goto("http://localhost:8080/", {
    waitUntil: "domcontentloaded"
  })

  console.log("Browser geöffnet.")
  console.log("Navigiere zur gewünschten Seite.")
  console.log("Drücke ENTER im Terminal, um den Screenshot aufzunehmen.")

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  await new Promise(resolve => rl.question("", resolve))
  rl.close()

  const output = path.join(outputDir, safeName + ".png")

  await page.screenshot({
    path: output,
    fullPage: false,
    animations: "disabled",
    caret: "hide"
  })

  console.log("Screenshot gespeichert:", output)

  await context.close()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
