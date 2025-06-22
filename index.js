const TelegramBot = require("node-telegram-bot-api")
const axios = require("axios")
const fs = require("fs")
const express = require("express")
const path = require("path")

const token = process.env.TELEGRAM_BOT_TOKEN
const owner = process.env.OWNER_ID
const PORT = process.env.PORT || 3000

const bot = new TelegramBot(token, { polling: true })
const app = express()

let urls = []
const file = "urls.json"

function loadUrls() {
  if (fs.existsSync(file)) {
    urls = JSON.parse(fs.readFileSync(file))
    urls.forEach(startMonitor)
  } else {
    urls = []
  }
}
function saveUrls() {
  fs.writeFileSync(file, JSON.stringify(urls, null, 2))
}
function startMonitor(site) {
  setInterval(async () => {
    const start = Date.now()
    try {
      await axios.get(site.url)
      const latency = Date.now() - start
      if (site.lastStatus !== "up") {
        bot.sendMessage(owner, `✅ ${site.url} is UP (latency: ${latency}ms)`)
      }
      site.lastStatus = "up"
      site.lastLatency = latency
    } catch (err) {
      if (site.lastStatus !== "down") {
        bot.sendMessage(owner, `🔻 ${site.url} is DOWN`)
      }
      site.lastStatus = "down"
      site.lastLatency = null
    }
    saveUrls()
  }, site.interval * 1000)
}

// Telegram Commands
bot.onText(/\/add (https?:\/\/[^\s]+) (\d+)/, (msg, match) => {
  const chatId = msg.chat.id
  const url = match[1]
  const interval = parseInt(match[2])

  if (urls.find(u => u.url === url)) {
    return bot.sendMessage(chatId, "❌ URL already monitored.")
  }

  const newSite = { url, interval, lastStatus: "unknown", lastLatency: null }
  urls.push(newSite)
  saveUrls()
  startMonitor(newSite)
  bot.sendMessage(chatId, `✅ Monitoring ${url} every ${interval}s`)
})

bot.onText(/\/remove (https?:\/\/[^\s]+)/, (msg, match) => {
  const chatId = msg.chat.id
  const url = match[1]
  urls = urls.filter(u => u.url !== url)
  saveUrls()
  bot.sendMessage(chatId, `🗑️ Stopped monitoring ${url}`)
})

bot.onText(/\/list/, (msg) => {
  if (urls.length === 0) return bot.sendMessage(msg.chat.id, "📭 No URLs being monitored.")
  const list = urls.map((u, i) => `${i + 1}. ${u.url} [${u.lastStatus}] (${u.interval}s, latency: ${u.lastLatency || 'N/A'}ms)`).join("\n")
  bot.sendMessage(msg.chat.id, `📡 Monitored URLs:\n\n${list}`)
})

// Web Dashboard
app.use(express.static(path.join(__dirname, "public")))
app.get("/data", (req, res) => {
  res.json(urls)
})
app.listen(PORT, () => console.log(`Dashboard running on port ${PORT}`))

loadUrls()
  
