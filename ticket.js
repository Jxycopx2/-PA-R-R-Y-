require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { SimpleShardingStrategy } = require('@discordjs/ws');
const {
    Client,
    GatewayIntentBits,
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    ActivityType,
    EmbedBuilder,
} = require('discord.js');

const TICKET_BOT_TOKEN = process.env.TICKET_BOT_TOKEN || process.env.BOT_TOKEN_2;
const CLIENT_ID = process.env.TICKET_CLIENT_ID || process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || '';

const WEB_PORT = process.env.PORT || process.env.WEB_PORT || 3000;
const WEB_BASE_URL = process.env.WEB_BASE_URL || `http://localhost:${WEB_PORT}`;

const TICKET_CATEGORY_IDS = {
    purchase: process.env.TICKET_CATEGORY_PURCHASE || '',
    car_rent: process.env.TICKET_CATEGORY_CAR_RENT || '',
    installment: process.env.TICKET_CATEGORY_INSTALLMENT || '',
    general: process.env.TICKET_CATEGORY_GENERAL || '',
};
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || '';

const TICKET_LOG_CHANNEL_ID = process.env.TICKET_LOG_CHANNEL_ID || '';
const STAFF_ROLE_IDS = (process.env.STAFF_ROLE_IDS || '').split(',').filter(Boolean);
const OWNER_IDS = (process.env.OWNER_IDS || '').split(',').map(x => x.trim()).filter(Boolean);

function isStaffMember(member) {
    if (!member) return false;
    if (OWNER_IDS.includes(member.id)) return true;
    return STAFF_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

const TICKET_PREFIX = 'ticket-';
const MAX_TICKETS_PER_USER = 3;

const LOGO_URL = process.env.LOGO_URL || '';

const SHOP_NAME = '𝐒𝐡𝐨𝐩 PA[R̲̅]R͎͍͐￫[Y̲̅] 𝐆𝐚𝐦𝐞 𝐢𝐭𝐞𝐦𝐬';

const EMOJIS = {
    purchase: { name: 'a:357726pinkbunnyshy', id: '1549498563896016977' },
    general: { name: '924615765137707008', id: '1363252416648188074' },
    car: { name: 'a:823464pinkbunnycute', id: '1549498614672400394' },
    installment: { name: 'a:jungwad_love', id: '1144991646799368222' },
    create: { name: 'a:jungwad_heart', id: '1151951001025261608' },
    myList: { name: 'a:arrow', id: '1457663782376575016' },
    claim: { name: '291197pinkbunnyclap', id: '1549498511685455952' },
    transcript: { name: '357726pinkbunnyshy', id: '1549498563896016977' },
    close: { name: '699622289376804917', id: '1363251868347928801' },
    clear: { name: 'trash', id: '1377760283870629969' },
};

if (!TICKET_BOT_TOKEN) {
    console.error('❌ กรุณาตั้งค่า TICKET_BOT_TOKEN ในไฟล์ .env');
    process.exit(1);
}

const COLORS = {
    primary: 0x6366f1,
    success: 0x10b981,
    danger: 0xf43f5e,
    warning: 0xfbbf24,
    info: 0x00f0ff,
    gold: 0xfbbf24,
    purple: 0xc084fc,
};

const TICKET_TYPES = [
    {
        id: 'purchase',
        prefix: 'ซื้อของ',
        label: 'ติดต่อซื้อของ',
        description: 'สั่งซื้อสินค้า',
        emoji: EMOJIS.purchase,
        color: COLORS.success,
        intro: 'กรุณาแจ้งรายการสินค้าที่ต้องการซื้อ',
    },
    {
        id: 'car_rent',
        prefix: 'เช่ารถ',
        label: 'ติดต่อเช่ารถ',
        description: 'ทำเรื่องเช่ารถ',
        emoji: EMOJIS.car,
        color: COLORS.warning,
        intro: 'กรุณาแจ้งรายละเอียด เช่น เช่ารถ ',
    },
    {
        id: 'installment',
        prefix: 'ผ่อนของ',
        label: 'ติดต่อผ่อนของ',
        description: 'ทำเรื่องผ่อนสินค้า',
        emoji: EMOJIS.installment,
        color: COLORS.purple,
        intro: 'กรุณาแจ้งสินค้าที่ต้องการผ่อน',
    },
    {
        id: 'general',
        prefix: 'สอบถาม',
        label: 'สอบถามทั่วไป',
        description: 'สอบถามข้อมูลทั่วไป',
        emoji: EMOJIS.general,
        color: COLORS.info,
        intro: 'กรุณาพิมพ์คำถามที่ต้องการสอบถามได้เลย ทีมงานจะตอบโดยเร็วที่สุด',
    },
];

const TRANSCRIPT_DIR = path.join(__dirname, 'transcripts');
const INDEX_FILE = path.join(TRANSCRIPT_DIR, 'index.json');

if (!fs.existsSync(TRANSCRIPT_DIR)) fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });
if (!fs.existsSync(INDEX_FILE)) fs.writeFileSync(INDEX_FILE, JSON.stringify({ transcripts: [] }, null, 2));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
    ],
    ws: {
        buildStrategy: (manager) => {
            manager.options.identifyProperties = {
                os: 'iOS',
                browser: 'Discord iOS',
                device: 'iOS',
            };
            return new SimpleShardingStrategy(manager);
        },
    },
});


function generateId() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function saveTranscript({ html, channelName, ownerTag, ownerId, messageCount, ticketType }) {
    const id = generateId();
    fs.writeFileSync(path.join(TRANSCRIPT_DIR, `${id}.html`), html, 'utf-8');

    let data = { transcripts: [] };
    try {
        const parsed = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
        data = (parsed && Array.isArray(parsed.transcripts)) ? parsed : { transcripts: [] };
    } catch { }

    data.transcripts.push({
        id, channelName, ownerTag, ownerId, messageCount, ticketType,
        createdAt: Date.now(),
    });
    fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2));

    return { id, url: `${WEB_BASE_URL}/transcript/${id}` };
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function timeAgo(ts) {
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);

    if (day > 0) return `${day}d`;
    if (hr > 0) return `${hr}h`;
    if (min > 0) return `${min}m`;
    return 'now';
}

function renderBtnClass(style) {
    if (style === 1) return 'btn-primary';
    if (style === 3) return 'btn-success';
    if (style === 4) return 'btn-danger';
    return 'btn-secondary';
}

function emojiToHtml(emoji, size, gap) {
    if (emoji?.id) {
        return `<img src="https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}" style="width:${size}px;height:${size}px;vertical-align:middle;margin-right:${gap}px">`;
    }
    if (emoji?.name) return `<span style="margin-right:${gap}px">${escapeHtml(emoji.name)}</span>`;
    return '';
}

function renderComponent(comp, userMap = {}) {
    if (!comp) return '';
    const type = comp.type;

    if (type === 17) {
        const accent = comp.accentColor != null
            ? '#' + comp.accentColor.toString(16).padStart(6, '0')
            : '#0f766e';
        let inner = '';
        if (comp.components) comp.components.forEach(c => { inner += renderComponent(c, userMap); });
        return `<div class="embed" style="border-left-color: ${accent}">${inner}</div>`;
    }

    if (type === 9) {
        let textContent = '';
        if (comp.components) {
            comp.components.forEach(c => {
                if (c.type === 10) textContent += renderComponent(c, userMap);
            });
        }
        const accessoryHtml = comp.accessory ? renderAccessory(comp.accessory) : '';
        if (accessoryHtml) {
            return `<div style="display:flex;gap:16px;align-items:flex-start">
                <div style="flex:1;min-width:0">${textContent}</div>
                <div style="flex-shrink:0">${accessoryHtml}</div>
            </div>`;
        }
        return textContent;
    }

    if (type === 10) {
        return `<div class="embed-desc" style="margin-bottom:4px">${formatDiscordText(comp.content || '', userMap)}</div>`;
    }

    if (type === 14) {
        const spacing = comp.spacing === 2 ? '12px' : '6px';
        return `<div class="divider" style="margin:${spacing} 0"></div>`;
    }

    if (type === 12) {
        let imgs = '';
        if (comp.items) {
            comp.items.forEach(item => {
                if (item.media?.url) {
                    imgs += `<img src="${escapeHtml(item.media.url)}" style="max-width:100%;border-radius:8px;margin:6px 0;display:block">`;
                }
            });
        }
        return imgs;
    }

    if (type === 1) {
        let buttons = '';
        if (comp.components) {
            comp.components.forEach(btn => {
                buttons += `<span class="btn ${renderBtnClass(btn.style)}">${emojiToHtml(btn.emoji, 18, 6)}${escapeHtml(btn.label || '')}</span>`;
            });
        }
        return `<div class="action-row">${buttons}</div>`;
    }

    if (type === 11) {
        if (comp.media?.url) return `<img src="${escapeHtml(comp.media.url)}" class="thumb-sm">`;
        return '';
    }

    return '';
}

function renderAccessory(acc) {
    if (!acc) return '';
    if (acc.type === 11) {
        if (acc.media?.url) return `<img src="${escapeHtml(acc.media.url)}" class="thumb">`;
        return '';
    }
    if (acc.type === 2) {
        return `<span class="btn btn-sm ${renderBtnClass(acc.style)}">${emojiToHtml(acc.emoji, 16, 4)}${escapeHtml(acc.label || '')}</span>`;
    }
    return '';
}

function formatDiscordText(text, userMap = {}) {
    if (!text) return '';
    let html = escapeHtml(text);

    html = html.replace(/&lt;@!?(\d+)&gt;/g, (m, id) => {
        const name = userMap[id] || `${id.slice(-4)}`;
        return `<span class="mention">@${escapeHtml(name)}</span>`;
    });

    html = html.replace(/&lt;@&amp;(\d+)&gt;/g, (m, id) => {
        const name = userMap[id] || `role:${id.slice(-4)}`;
        return `<span class="mention">@${escapeHtml(name)}</span>`;
    });

    html = html.replace(/&lt;#(\d+)&gt;/g, (m, id) => {
        const name = userMap[id] || `ch:${id.slice(-4)}`;
        return `<span class="mention">#${escapeHtml(name)}</span>`;
    });

    html = html.replace(/&lt;t:(\d+)(?::([tTdDfFR]))?&gt;/g, (m, ts, fmt) => {
        const d = new Date(parseInt(ts) * 1000);
        const diff = Math.floor((Date.now() - d.getTime()) / 1000);

        if (fmt === 'R') {
            const abs = Math.abs(diff);
            let str;
            if (abs < 60) str = 'เมื่อสักครู่';
            else if (abs < 3600) str = `${Math.floor(abs / 60)} นาทีที่แล้ว`;
            else if (abs < 86400) str = `${Math.floor(abs / 3600)} ชั่วโมงที่แล้ว`;
            else str = `${Math.floor(abs / 86400)} วันที่แล้ว`;
            if (diff < 0) str = str.replace('ที่แล้ว', 'ข้างหน้า');
            return `<span style="color:var(--text-muted)">${str}</span>`;
        }
        return `<span style="color:var(--text-muted)">${d.toLocaleString('th-TH')}</span>`;
    });

    html = html.replace(/&lt;a?:(\w+):(\d+)&gt;/g, (m, name) => `<span style="display:inline-block;vertical-align:middle">:${name}:</span>`);

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary);font-weight:700">$1</strong>');
    html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/_([^_\n]+?)_/g, '<em>$1</em>');
    html = html.replace(/__(.+?)__/g, '<u>$1</u>');
    html = html.replace(/~~(.+?)~~/g, '<s style="color:var(--text-faint)">$1</s>');
    html = html.replace(/`([^`\n]+?)`/g, '<code style="padding:2px 6px;border-radius:4px;font-family:Consolas,monospace;font-size:0.85em;border:1px solid">$1</code>');
    html = html.replace(/```([\s\S]+?)```/g, '<pre style="background:var(--bg-tertiary);padding:14px 16px;border-radius:8px;font-family:Consolas,monospace;font-size:0.85em;overflow-x:auto;margin:8px 0;border:1px solid var(--border);color:var(--text-primary)"><code>$1</code></pre>');

    html = html.replace(/(https?:\/\/[^\s<"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;word-break:break-all">$1</a>');

    html = html.replace(/\n/g, '<br>');
    return html;
}

const createWeb = (function () {
    const module = {};
    module.exports = function createWeb({ escapeHtml, formatDiscordText, renderComponent, timeAgo, shopName }) {
        const FAVICON = `<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐰</text></svg>">`;
        const GFONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&family=Baloo+2:wght@500;600;700;800&display=swap" rel="stylesheet">`;
        const BASE_CSS = `
    :root{
        --pink:#f472b6; --purple:#a78bfa; --cyan:#22d3ee; --lilac:#c4b5fd;
        --bg-a:#ffd9ef; --bg-b:#e3c9fb; --bg-c:#bdeeff;
        --card:rgba(255,255,255,.82); --card-solid:#ffffff; --line:rgba(140,105,185,.18);
        --brand:#c026a3; --brand-soft:#fbe3f6; --pop:#f97316;
        --text-primary:#3a2a52; --text-secondary:#5d4a78; --text-muted:#8b78a8; --text-faint:#b2a3cc;
        --accent-2:#0891b2; --bg-tertiary:#f3e9ff; --border:rgba(140,105,185,.18);
        --shadow-soft:0 10px 30px rgba(168,110,200,.18);
    }
    *{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth}
    body{
        font-family:'Noto Sans Thai','Sarabun',-apple-system,'Segoe UI',sans-serif;
        color:var(--text-primary);font-size:15px;line-height:1.65;min-height:100vh;
        background:
            radial-gradient(circle at 12% 18%, rgba(255,255,255,.65) 0, rgba(255,255,255,0) 4%),
            radial-gradient(circle at 78% 8%, rgba(255,255,255,.55) 0, rgba(255,255,255,0) 3%),
            radial-gradient(circle at 88% 64%, rgba(255,255,255,.5) 0, rgba(255,255,255,0) 3%),
            radial-gradient(circle at 30% 85%, rgba(255,255,255,.5) 0, rgba(255,255,255,0) 3%),
            linear-gradient(145deg, var(--bg-a) 0%, var(--bg-b) 45%, var(--bg-c) 100%);
        background-attachment:fixed;
    }
    h1,h2,h3,.shop,.hero h1,.head h1{font-family:'Baloo 2','Noto Sans Thai',sans-serif}
    a{color:var(--brand)}
    .top{background:rgba(255,255,255,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
        border-bottom:1px solid rgba(255,255,255,.6);box-shadow:0 2px 16px rgba(168,110,200,.1);position:sticky;top:0;z-index:5}
    .top-in{max-width:900px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
    .shop{font-weight:800;letter-spacing:.2px;text-decoration:none;font-size:17px;
        background:linear-gradient(90deg,var(--pink),var(--purple) 55%,var(--accent-2));
        -webkit-background-clip:text;background-clip:text;color:transparent}
    .chip{background:var(--brand-soft);color:var(--brand);border-radius:999px;padding:3px 12px;font-size:12px;font-weight:700;
        border:1px solid rgba(192,38,163,.15)}
    .wrap{max-width:900px;margin:0 auto;padding:24px 20px 60px}
    code{color:var(--brand)!important;background:var(--brand-soft)!important;border-color:#f0c9e8!important}
    .mention{background:#eaf7fb;color:#0e7490;border-radius:4px;padding:0 5px;font-weight:600}
    .embed{margin-top:8px;padding:14px 16px;background:#fff;border:1px solid var(--line);border-left:5px solid var(--purple);border-radius:12px;max-width:600px;box-shadow:0 2px 10px rgba(168,110,200,.08)}
    .embed-author{display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px;margin-bottom:8px}
    .embed-author img{width:20px;height:20px;border-radius:50%}
    .embed-title{font-weight:700;margin-bottom:6px}
    .embed-desc{color:var(--text-secondary);font-size:14px}
    .embed-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:8px}
    .field-name{font-size:12px;font-weight:700;color:var(--brand)}
    .field-value{font-size:14px;color:var(--text-secondary)}
    .embed-footer{font-size:11px;color:var(--text-faint);margin-top:10px;border-top:1px solid var(--line);padding-top:8px}
    .divider{height:1px;background:linear-gradient(90deg,transparent,rgba(140,105,185,.3),transparent)}
    .action-row{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px}
    .btn{display:inline-flex;align-items:center;padding:6px 14px;border-radius:999px;font-size:13px;
        background:linear-gradient(90deg,var(--brand-soft),#e3f6fb);color:var(--brand);border:1px solid #f0c9e8}
    .btn-sm{padding:4px 10px;font-size:12px}
    .thumb{width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid #fff;box-shadow:0 2px 8px rgba(168,110,200,.2)}
    .thumb-sm{max-width:72px;border-radius:10px}`;

        function transcript({ channel, messages, owner, userMap = {} }) {
            const total = messages.length;
            const created = messages[0] ? messages[0].createdTimestamp : Date.now();

            const fmt = (ts, o = {}) => new Date(ts).toLocaleString('th-TH', {
                timeZone: 'Asia/Bangkok',
                calendar: 'buddhist',
                ...o
            });

            let html = '';
            let lastId = null, lastTs = 0;
            for (const m of messages) {
                const a = m.author;
                const same = a.id === lastId && m.createdTimestamp - lastTs < 300000 && !m.reference;
                lastId = a.id; lastTs = m.createdTimestamp;

                let body = '';
                if (m.content) body += `<div class="text">${formatDiscordText(m.content, userMap)}</div>`;
                m.attachments?.forEach(att => {
                    body += /\.(png|jpe?g|gif|webp)$/i.test(att.name || '')
                        ? `<a href="${escapeHtml(att.url)}" target="_blank"><img class="att" src="${escapeHtml(att.url)}" loading="lazy"></a>`
                        : `<div><a href="${escapeHtml(att.url)}" target="_blank">📎 ${escapeHtml(att.name)}</a></div>`;
                });
                m.embeds?.forEach(e => {
                    const c = e.color != null ? '#' + e.color.toString(16).padStart(6, '0') : '#0f766e';
                    body += `<div class="embed" style="border-left-color:${c}">`;
                    if (e.author?.name) body += `<div class="embed-author">${e.author.iconURL ? `<img src="${escapeHtml(e.author.iconURL)}">` : ''}${escapeHtml(e.author.name)}</div>`;
                    if (e.title) body += `<div class="embed-title">${escapeHtml(e.title)}</div>`;
                    if (e.description) body += `<div class="embed-desc">${formatDiscordText(e.description, userMap)}</div>`;
                    if (e.fields?.length) body += `<div class="embed-fields">${e.fields.map(f => `<div><div class="field-name">${escapeHtml(f.name)}</div><div class="field-value">${formatDiscordText(f.value, userMap)}</div></div>`).join('')}</div>`;
                    if (e.footer?.text) body += `<div class="embed-footer">${escapeHtml(e.footer.text)}</div>`;
                    body += `</div>`;
                });
                m.components?.forEach(c => { body += renderComponent(c, userMap); });
                if (!body) body = `<div class="text" style="color:var(--text-faint)">[ไม่มีข้อความ]</div>`;

                const time = fmt(m.createdTimestamp, { hour: '2-digit', minute: '2-digit', hour12: false });
                if (same) {
                    html += `<div class="row cont"><span class="t">${time}</span><div class="bubble">${body}</div></div>`;
                } else {
                    html += `<div class="row ${a.bot ? 'bot' : ''}">
                    <img class="av" src="${a.displayAvatarURL({ extension: 'png', size: 128 })}">
                    <div class="bubble"><div class="who"><b>${escapeHtml(a.globalName || a.username)}</b>${a.bot ? '<i>BOT</i>' : ''}<span>${fmt(m.createdTimestamp, { dateStyle: 'short', timeStyle: 'short', hour12: false })}</span></div>${body}</div></div>`;
                }
            }

            return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(channel.name)} · ${escapeHtml(shopName)}</title>${FAVICON}
${GFONTS}
<style>${BASE_CSS}
    .hero{position:relative;overflow:hidden;background:var(--card);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
        border:1px solid rgba(255,255,255,.7);border-radius:20px;padding:24px 26px;margin-bottom:22px;box-shadow:var(--shadow-soft)}
    .hero::before{content:'✨';position:absolute;right:18px;top:14px;font-size:22px;opacity:.55}
    .hero h1{font-size:25px;font-weight:800;background:linear-gradient(90deg,var(--brand),var(--accent-2));
        -webkit-background-clip:text;background-clip:text;color:transparent;display:inline-block}
    .meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
    .row{display:flex;gap:12px;margin-top:14px}
    .row.cont{margin-top:3px;padding-left:52px;position:relative}
    .row.cont .t{position:absolute;left:0;width:44px;text-align:right;font-size:10px;color:var(--text-faint);opacity:0;padding-top:8px}
    .row.cont:hover .t{opacity:1}
    .av{width:40px;height:40px;border-radius:50%;flex-shrink:0;object-fit:cover;border:2px solid #fff;box-shadow:0 2px 6px rgba(168,110,200,.25)}
    .bubble{background:var(--card-solid);border:1px solid var(--line);border-radius:4px 16px 16px 16px;padding:10px 14px;min-width:0;max-width:100%;overflow-wrap:anywhere;box-shadow:0 2px 8px rgba(168,110,200,.06)}
    .row.bot .bubble{background:linear-gradient(135deg,#fdf0fb,#eaf9fd);border-color:#f0c9e8}
    .who{display:flex;align-items:center;gap:8px;margin-bottom:2px;flex-wrap:wrap}
    .who b{color:var(--text-primary)}
    .who i{background:linear-gradient(90deg,var(--pink),var(--purple));color:#fff;font-style:normal;font-size:10px;font-weight:700;padding:1px 7px;border-radius:999px}
    .who span{font-size:11px;color:var(--text-faint)}
    .text{white-space:pre-wrap;color:var(--text-secondary)}
    .att{max-width:100%;max-height:320px;border-radius:12px;margin-top:8px;display:block;border:1px solid var(--line)}
    .end{text-align:center;color:var(--text-faint);font-size:13px;margin-top:40px;letter-spacing:.3px}
    .end::before,.end::after{content:'🎀';margin:0 10px;opacity:.6}
</style></head><body>
<div class="top"><div class="top-in"><a class="shop" href="/">${escapeHtml(shopName)}</a><span class="chip">📄 Transcript</span></div></div>
<div class="wrap">
    <div class="hero"><h1>#${escapeHtml(channel.name)}</h1>
        <div class="meta"><span class="chip">👤 ${escapeHtml(owner.tag)}</span><span class="chip">💬 ${total} ข้อความ</span><span class="chip">🕐 ${fmt(created, { dateStyle: 'short', timeStyle: 'short', hour12: false })}</span></div></div>
    ${html}
    <div class="end">จบบทสนทนา</div>
</div></body></html>`;
        }

        function index(list) {
            const safeList = Array.isArray(list) ? list : [];
            const sorted = [...safeList].sort((a, b) => b.createdAt - a.createdAt);
            const msgs = sorted.reduce((s, t) => s + (t.messageCount || 0), 0);
            const cards = sorted.map(t => {
                // ดึงรูป Avatar จากตัวแปร ownerAvatar, owner.displayAvatarURL, หรือเผื่อเป็นฟังก์ชัน/สตริงอื่นๆ
                const avatarUrl = t.ownerAvatar || 
                                  (typeof t.owner?.displayAvatarURL === 'function' ? t.owner.displayAvatarURL({ extension: 'png', size: 128 }) : null) || 
                                  t.owner?.avatarURL || 
                                  'https://cdn.discordapp.com/embed/avatars/0.png';
                
                return `
            <div class="card" data-s="${escapeHtml((t.channelName + ' ' + t.ownerTag).toLowerCase())}">
                <div class="c-top"><span class="chip">${escapeHtml(t.ticketType || 'other')}</span><small>${timeAgo(t.createdAt)}</small></div>
                <h3>${escapeHtml(t.channelName)}</h3>
                <div class="owner-info">
                    <img class="owner-avatar" src="${escapeHtml(avatarUrl)}" alt="Avatar">
                    <p>👤 ${escapeHtml(t.ownerTag)}</p>
                </div>
                <p style="margin-top:4px;">💬 ${t.messageCount || 0} ข้อความ</p>
            </div>`;
            }).join('');

            return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Transcripts · ${escapeHtml(shopName)}</title>${FAVICON}
${GFONTS}
<style>${BASE_CSS}
    .head{position:relative;text-align:center;padding:36px 20px 22px}
    .head::before{content:'✨ 🎀 ✨';position:absolute;top:2px;left:50%;transform:translateX(-50%);font-size:14px;opacity:.6;letter-spacing:6px}
    .head h1{font-size:32px;font-weight:800;margin-top:6px;
        background:linear-gradient(90deg,var(--pink),var(--purple) 50%,var(--accent-2));
        -webkit-background-clip:text;background-clip:text;color:transparent}
    .head p{color:var(--text-muted);margin-top:6px}
    .stats{display:flex;justify-content:center;gap:14px;margin:20px 0;flex-wrap:wrap}
    .stat{background:var(--card);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.7);
        border-radius:16px;padding:14px 28px;text-align:center;box-shadow:var(--shadow-soft)}
    .stat b{display:block;font-size:26px;background:linear-gradient(90deg,var(--pink),var(--purple));-webkit-background-clip:text;background-clip:text;color:transparent}
    .stat span{font-size:12px;color:var(--text-muted);font-weight:600}
    #q{display:block;width:100%;max-width:420px;margin:0 auto 24px;padding:12px 20px;border-radius:999px;border:1px solid rgba(255,255,255,.7);
        background:var(--card);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font:inherit;outline:none;box-shadow:0 2px 12px rgba(168,110,200,.1)}
    #q:focus{border-color:var(--pink);box-shadow:0 0 0 3px rgba(244,114,182,.18)}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
    .card{position:relative;background:var(--card);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
        border:1px solid rgba(255,255,255,.7);border-radius:18px;padding:17px;color:inherit;
        box-shadow:0 4px 16px rgba(168,110,200,.1)}
    .owner-info{display:flex;align-items:center;gap:8px;margin-top:4px}
    .owner-avatar{width:24px;height:24px;border-radius:50%;object-fit:cover;border:1px solid #fff;box-shadow:0 1px 4px rgba(168,110,200,.2)}
    .c-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}
    .c-top small{color:var(--text-faint);font-weight:600}
    .card h3{font-size:16px;margin-bottom:2px;overflow-wrap:anywhere;color:var(--text-primary)}
    .card p{font-size:13px;color:var(--text-muted);display:inline}
    .empty{text-align:center;color:var(--text-faint);padding:60px 0;font-size:15px}
    .empty::before{content:'🐰';display:block;font-size:40px;margin-bottom:10px}
</style></head><body>
<div class="top"><div class="top-in"><span class="shop">${escapeHtml(shopName)}</span><span class="chip">🎫 Ticket Archive</span></div></div>
<div class="wrap">
    <div class="head"><h1>บันทึกบทสนทนา</h1><p>เลือกการ์ดเพื่อดู Transcript</p></div>
    <div class="stats"><div class="stat"><b>${sorted.length}</b><span>Transcripts</span></div><div class="stat"><b>${msgs}</b><span>Messages</span></div></div>
    <input id="q" placeholder="🔍 ค้นหาห้อง / ผู้ใช้...">
    <div class="grid" id="g">${cards}</div>
    ${sorted.length ? '' : '<div class="empty">ยังไม่มี transcript</div>'}
</div>
<script>
    document.getElementById('q').addEventListener('input', e => {
        const q = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.card').forEach(c => { c.style.display = c.dataset.s.includes(q) ? '' : 'none'; });
    });
</script></body></html>`;
        }

        return { transcript, index };
    };

    return module.exports;
})();

const web = createWeb({ escapeHtml, formatDiscordText, renderComponent, timeAgo, shopName: SHOP_NAME });

function buildTicketPanel() {
    return {
        flags: 32768,
        components: [
            {
                type: 17,
                accent_color: 0x000000,
                components: [
                    { type: 10, content: `# **${SHOP_NAME}**` },
                    { type: 14, divider: true, spacing: 1 },
                    {
                        type: 10,
                        content:
                            `-  **ติดต่อซื้อของ** **— ** **สั่งซื้อสินค้า**\n\n` +
                            `- **ติดต่อเช่ารถ** **—** **ทำเรื่องเช่ารถ**\n\n` +
                            `- **ติดต่อผ่อนของ** **—** **ทำเรื่องผ่อนสินค้า**\n\n` +
                            `-  **สอบถามทั่วไป** **—** **สอบถามข้อมูลต่างๆ**`
                    },
                    { type: 14, divider: false, spacing: 1 },
                    {
                        type: 12,
                        items: [
                            {
                                media: {
                                    url: 'https://media.discordapp.net/attachments/1532443613034844240/1548228195076014160/1789196368272.jpg?ex=6ac0009e&is=6abeaf1e&hm=66457b1fae9b8660216fd440765ebca84c7d61728725d4d46241fc00203ff4b5&=&format=webp'
                                }
                            }
                        ]
                    },
                    { type: 14, divider: false, spacing: 2 },
                    {
                        type: 1,
                        components: [
                            {
                                type: 2, style: 2, label: 'เปิด Ticket',
                                emoji: { animated: true, name: EMOJIS.create.name, id: EMOJIS.create.id },
                                custom_id: 'ticket_create',
                            },
                            {
                                type: 2, style: 2, label: 'ดู Ticket ของฉัน',
                                emoji: { animated: true, name: EMOJIS.myList.name, id: EMOJIS.myList.id },
                                custom_id: 'ticket_my_list',
                            },
                        ]
                    }
                ]
            }
        ]
    };
}

function buildTypeSelectMessage() {
    return {
        flags: 32768,
        components: [
            {
                type: 17,
                accent_color: 0x000000,
                components: [
                    { type: 10, content: '- `🎫` **เลือกประเภท Ticket**\n**กรุณาเลือกหัวข้อที่ต้องการติดต่อ**' },
                    { type: 14, divider: true, spacing: 1 },
                    {
                        type: 10,
                        content:
                            `-  **ติดต่อซื้อของ** **—** **สั่งซื้อสินค้า**\n\n` +
                            `- **ติดต่อเช่ารถ** **—** **ทำเรื่องเช่ารถ**\n\n` +
                            `- **ติดต่อผ่อนของ** **—** **ทำเรื่องผ่อนสินค้า**\n\n` +
                            `-  **สอบถามทั่วไป** **—** **สอบถามข้อมูลต่างๆ**`
                    },
                    { type: 14, divider: false, spacing: 2 },
                    {
                        type: 1,
                        components: [
                            {
                                type: 3,
                                custom_id: 'ticket_type_select',
                                placeholder: '📋 เลือกประเภท Ticket ที่ต้องการ...',
                                options: [
                                    ...TICKET_TYPES.map(t => ({
                                        label: t.label,
                                        description: t.description,
                                        value: t.id,
                                        emoji: { animated: true, name: t.emoji.name, id: t.emoji.id }
                                    })),
                                    {
                                        label: 'ล้างตัวเลือก',
                                        description: 'รีเซ็ตกลับเป็นค่าเริ่มต้น',
                                        value: 'clear',
                                        emoji: { animated: true, name: EMOJIS.clear.name, id: EMOJIS.clear.id },
                                    },
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    };
}

function buildTicketWelcome({ user, typeInfo, ticketNumber }) {
    return {
        flags: 32768,
        components: [
            {
                type: 17,
                accent_color: 0x000000,
                components: [
                    {
                        type: 9,
                        components: [{ type: 10, content: `# ${typeInfo.label}\n\n- **Ticket #${ticketNumber} จาก <@${user.id}>**` }],
                        accessory: { type: 11, media: { url: user.displayAvatarURL({ dynamic: true, size: 256 }) } }
                    },
                    { type: 14, divider: true, spacing: 1 },
                    {
                        type: 10,
                        content:
                            `- สวัสดี <@${user.id}> \`👋\` \n\n` +
                            `- ${typeInfo.intro}\n\n` +
                            `- \`⏱️\` **ทีมงานจะตอบกลับโดยเร็วที่สุด**`
                    },
                    { type: 14, divider: false, spacing: 1 },
                    {
                        type: 10,
                        content:
                            `- \`👤\` **ผู้เปิด:** <@${user.id}>\n\n` +
                            `- \`📁\` **ประเภท:** ${typeInfo.label}\n\n` +
                            `- \`🔢\` **Ticket #:** ${ticketNumber}\n\n` +
                            `- \`🕐\` **เวลา:** <t:${Math.floor(Date.now() / 1000)}:R>`
                    },
                    { type: 14, divider: false, spacing: 2 },
                    {
                        type: 1,
                        components: [
                            {
                                type: 2, style: 2, label: 'รับเรื่อง',
                                emoji: { animated: true, name: EMOJIS.claim.name, id: EMOJIS.claim.id },
                                custom_id: 'ticket_claim',
                            },
                            {
                                type: 2, style: 2, label: 'บันทึกบทสนทนา',
                                emoji: { animated: true, name: EMOJIS.transcript.name, id: EMOJIS.transcript.id },
                                custom_id: 'ticket_transcript',
                            },
                            {
                                type: 2, style: 2, label: 'ปิด Ticket',
                                emoji: { animated: true, name: EMOJIS.close.name, id: EMOJIS.close.id },
                                custom_id: 'ticket_close',
                            },
                        ]
                    }
                ]
            }
        ]
    };
}

function getCategoryIdForType(typeId) {
    if (TICKET_CATEGORY_IDS[typeId]) return TICKET_CATEGORY_IDS[typeId];
    return TICKET_CATEGORY_ID || null;
}

async function ensureCategory(guild, typeInfo) {
    const existingId = getCategoryIdForType(typeInfo.id);
    if (existingId) {
        const existing = guild.channels.cache.get(existingId);
        if (existing) return existing;
    }

    const catName = `╰┈➤Ი𐑼 ${typeInfo.label}`;
    const found = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === catName
    );
    if (found) return found;

    try {
        const category = await guild.channels.create({
            name: catName,
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                ...STAFF_ROLE_IDS.map(roleId => ({
                    id: roleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                    ],
                })),
            ],
        });
        console.log(`✅ สร้าง category "${typeInfo.label}" อัตโนมัติ: ${category.id}`);
        return category;
    } catch (err) {
        console.error('Create category error:', err.message);
        return null;
    }
}

function getNextTicketNumber(guild, typePrefix) {
    let maxNum = 0;
    const safe = typePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^ticket-${safe}-(\\d+)`);
    guild.channels.cache.forEach(ch => {
        if (ch.name) {
            const match = ch.name.match(pattern);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) maxNum = num;
            }
        }
    });
    return maxNum + 1;
}

function formatTicketNumber(num) {
    return String(num).padStart(3, '0');
}

async function createTicketChannel(interaction, ticketTypeId) {
    const guild = interaction.guild;
    const user = interaction.user;
    const typeInfo = TICKET_TYPES.find(t => t.id === ticketTypeId) || TICKET_TYPES[0];

    const existingChannels = guild.channels.cache.filter(ch =>
        ch.name.startsWith(TICKET_PREFIX) &&
        ch.type === ChannelType.GuildText &&
        ch.permissionOverwrites.cache.has(user.id)
    );

    if (existingChannels.size >= MAX_TICKETS_PER_USER) {
        throw new Error(`คุณมี Ticket เปิดอยู่แล้ว ${existingChannels.size} ห้อง (สูงสุด ${MAX_TICKETS_PER_USER} ห้อง)\nกรุณาปิด Ticket เก่าก่อน`);
    }

    const permissionOverwrites = [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
            id: user.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
            ],
        },
    ];

    STAFF_ROLE_IDS.forEach(roleId => {
        permissionOverwrites.push({
            id: roleId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
            ],
        });
    });

    const typePrefix = typeInfo.prefix || typeInfo.id;
    const ticketNumberStr = formatTicketNumber(getNextTicketNumber(guild, typePrefix));
    const rawName = user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
    const username = rawName || user.id.slice(-6);

    const channelOptions = {
        name: `${TICKET_PREFIX}${typePrefix}-${ticketNumberStr}-${username}`,
        type: ChannelType.GuildText,
        permissionOverwrites,
        topic: `Ticket #${ticketNumberStr} ของ ${user.tag} ประเภท: ${typeInfo.label}`,
    };

    const category = await ensureCategory(guild, typeInfo);
    if (category) channelOptions.parent = category.id;

    const ticketChannel = await guild.channels.create(channelOptions);

    await ticketChannel.send(buildTicketWelcome({ user, typeInfo, ticketNumber: ticketNumberStr }));
    if (['purchase', 'installment', 'car_rent'].includes(typeInfo.id)) {
        const PAYMENT_IMAGE_URL = 'https://media.discordapp.net/attachments/1527101921125601391/1548239741957181511/lv_0_20260704020236-2.jpg?ex=6abf629f&is=6abe111f&hm=733867907a74adc72933cba3a0e1d0dbc3821b4c9f01cb7f9887f7f4389f2f58&=&format=webp&width=683&height=1024';

        await ticketChannel.send({
            flags: 32768,
            components: [
                {
                    type: 17,
                    accent_color: 0x7c3aed,
                    components: [
                        { type: 10, content: `- \`💳\` **ช่องทางการโอนเงิน**` },
                        { type: 14, divider: true, spacing: 1 },
                        { type: 12, items: [{ media: { url: PAYMENT_IMAGE_URL } }] },
                    ],
                },
            ],
        });
    }

    if (TICKET_LOG_CHANNEL_ID) {
        try {
            const logCh = await client.channels.fetch(TICKET_LOG_CHANNEL_ID);
            if (logCh) {
                const logoUrl = LOGO_URL || guild.iconURL({ extension: 'png', size: 1024 }) || '';
                await logCh.send({
                    flags: 32768,
                    components: [
                        {
                            type: 17,
                            accent_color: 0x000000,
                            components: [
                                {
                                    type: 9,
                                    components: [
                                        { type: 10, content: `- \`🎫\` **Ticket ใหม่** #${ticketNumberStr}\n\nn- **<@${user.id}> เปิด Ticket**` },
                                    ],
                                    accessory: {
                                        type: 11,
                                        media: { url: user.displayAvatarURL({ extension: 'png', size: 256 }) },
                                    },
                                },
                                { type: 14, divider: true, spacing: 1 },
                                {
                                    type: 10,
                                    content:
                                        `- \`👤\` **ผู้เปิด:** <@${user.id}>\n` +
                                        `- \`🔢\` **Ticket #:** ${ticketNumberStr}\n` +
                                        `- \`📁\` **ประเภท:**  ${typeInfo.label}\n` +
                                        `-  **ห้อง:** <#${ticketChannel.id}>`
                                },
                                ...(logoUrl ? [
                                    { type: 14, divider: false, spacing: 1 },
                                    { type: 12, items: [{ media: { url: logoUrl } }] },
                                ] : []),
                            ]
                        }
                    ]
                });
            }
        } catch (err) {
            console.error('Log error:', err.message);
        }
    }

    return ticketChannel;
}

async function closeTicket(interaction) {
    const channel = interaction.channel;
    if (!channel.name.startsWith(TICKET_PREFIX)) {
        return interaction.reply({ content: '❌ ห้องนี้ไม่ใช่ Ticket', flags: 64 });
    }

    if (!isStaffMember(interaction.member)) {
        return interaction.reply({ content: '❌ เฉพาะทีมงานเท่านั้นที่ปิด Ticket ได้', flags: 64 });
    }

    const guildIcon = interaction.guild.iconURL({ size: 256 }) ?? null;
    const deleteAt = Math.floor(Date.now() / 1000) + 5;

    const closeEmbed = new EmbedBuilder()
        .setColor(COLORS.danger)
        .setAuthor({
            name: `${interaction.guild.name} • ระบบ Ticket`,
            iconURL: guildIcon ?? undefined,
        })
        .setTitle('🔒 กำลังปิด Ticket')
        .setDescription(
            '- **ขอบคุณที่ใช้บริการค้าบ** `💙`\n' +
            '`ระบบกำลังลบห้องนี้ในอีกไม่กี่วินาที`'
        )
        .addFields(
            { name: '👤 ปิดโดย', value: `<@${interaction.user.id}>`, inline: true },
            { name: '📁 ห้อง', value: `\`${channel.name}\``, inline: true },
            { name: '⏳ ลบห้อง', value: `<t:${deleteAt}:R>`, inline: true }
        )
        .setFooter({ text: interaction.guild.name, iconURL: guildIcon ?? undefined })
        .setTimestamp();

    if (guildIcon) closeEmbed.setThumbnail(guildIcon);

    await interaction.reply({ embeds: [closeEmbed] });

    setTimeout(async () => {
        try { await channel.delete(`Ticket closed by ${interaction.user.tag}`); }
        catch (err) { console.error('Delete channel error:', err.message); }
    }, 5000);
}

async function listMyTickets(interaction) {
    const guild = interaction.guild;
    const user = interaction.user;

    const myTickets = guild.channels.cache.filter(ch =>
        ch.name.startsWith(TICKET_PREFIX) &&
        ch.type === ChannelType.GuildText &&
        ch.permissionOverwrites.cache.has(user.id)
    );

    if (myTickets.size === 0) {
        return interaction.reply({
            flags: 32768 | 64,
            components: [
                {
                    type: 17,
                    accent_color: 0x000000,
                    components: [
                        { type: 10, content: '# `📭` **ยังไม่มี Ticket**\n**คุณยังไม่มี Ticket ที่เปิดอยู่**' }
                    ]
                }
            ]
        });
    }

    const ticketLines = myTickets.map(ch =>
        `> • <#${ch.id}> — <t:${Math.floor(ch.createdTimestamp / 1000)}:R>`
    ).join('\n');

    return interaction.reply({
        flags: 32768 | 64,
        components: [
            {
                type: 17,
                accent_color: 0x000000,
                components: [
                    { type: 10, content: `# \`📋\` **Ticket ของคุณ**\n**ทั้งหมด ${myTickets.size} ห้อง**` },
                    { type: 14, divider: true, spacing: 1 },
                    { type: 10, content: ticketLines }
                ]
            }
        ]
    });
}

async function claimTicket(interaction) {
    const channel = interaction.channel;
    const member = interaction.member;

    if (!channel.name.startsWith(TICKET_PREFIX)) {
        return interaction.reply({ content: '❌ ห้องนี้ไม่ใช่ Ticket', flags: 64 });
    }

    if (!isStaffMember(member)) {
        return interaction.reply({ content: '❌ เฉพาะทีมงานเท่านั้นที่รับเรื่องได้', flags: 64 });
    }

    return interaction.reply({
        flags: 32768,
        components: [
            {
                type: 17,
                accent_color: 0x000000,
                components: [
                    { type: 10, content: `# \`✋\` **รับเรื่องแล้ว**\n**<@${member.id}> รับผิดชอบ Ticket นี้**` }
                ]
            }
        ]
    });
}

async function fetchAllMessages(channel, maxMessages = 2000) {
    const allMessages = [];
    let lastId = null;

    while (allMessages.length < maxMessages) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const fetched = await channel.messages.fetch(options);
        if (fetched.size === 0) break;

        allMessages.push(...fetched.values());
        lastId = fetched.last().id;
        if (fetched.size < 100) break;
    }

    return allMessages.reverse();
}

async function transcriptTicket(interaction) {
    const channel = interaction.channel;
    if (!channel.name.startsWith(TICKET_PREFIX)) {
        return interaction.reply({ content: '❌ ห้องนี้ไม่ใช่ Ticket', flags: 64 });
    }

    await interaction.deferReply({ flags: 64 });

    const sorted = await fetchAllMessages(channel, 2000);

    const userMap = {};
    interaction.guild.members.cache.forEach(m => {
        userMap[m.id] = m.user.globalName || m.user.username;
    });

    interaction.guild.channels.cache.forEach(ch => { userMap[ch.id] = ch.name; });
    interaction.guild.roles.cache.forEach(r => { userMap[r.id] = r.name; });

    sorted.forEach(m => {
        if (m.author && !userMap[m.author.id]) {
            userMap[m.author.id] = m.author.globalName || m.author.username;
        }
    });

    const botId = client.user.id;
    const ownerOverwrite = channel.permissionOverwrites.cache.find(
        ow =>
            ow.type === 1 &&
            ow.id !== botId &&
            !STAFF_ROLE_IDS.includes(ow.id) &&
            ow.allow.has(PermissionFlagsBits.ViewChannel)
    );

    if (!ownerOverwrite) {
        return interaction.editReply({ content: '❌ ไม่พบเจ้าของ Ticket ไม่สามารถส่ง DM ได้' });
    }

    const ownerId = ownerOverwrite.id;

    try {
        const owner = await client.users.fetch(ownerId);

        const html = web.transcript({ channel, messages: sorted, owner, userMap });

        const typeMatch = channel.name.match(/^ticket-(.+?)-\d+-/);
        const ticketType = typeMatch ? typeMatch[1] : 'unknown';

        const { url } = saveTranscript({
            html,
            channelName: channel.name,
            ownerTag: owner.tag,
            ownerId: owner.id,
            messageCount: sorted.length,
            ticketType,
        });

        const guildIcon = interaction.guild.iconURL({ size: 256 }) ?? null;

        const isPublicUrl = url && !url.includes('localhost') && !url.includes('127.0.0.1');

        const linkButtonRow = (label) => ({
            type: 1,
            components: [
                {
                    type: 2, style: 5, label, url,
                    emoji: { animated: true, name: 'a:Alert2', id: '1229066611412041779' },
                },
            ],
        });

        const dmHeader = {
            type: 10,
            content: '# \`📄\` **บันทึกบทสนทนา Ticket**\n\n- **ขอบคุณที่ใช้บริการค้าบ** \`💙\`',
        };

        await owner.send({
            flags: 32768,
            components: [
                {
                    type: 17,
                    accent_color: COLORS.primary,
                    components: [
                        guildIcon
                            ? { type: 9, components: [dmHeader], accessory: { type: 11, media: { url: guildIcon } } }
                            : dmHeader,
                        { type: 14, divider: true, spacing: 1 },
                        {
                            type: 10,
                            content:
                                `- \`📁\` **ห้อง:** \`${channel.name}\`\n` +
                                `- \`💬\` **จำนวนข้อความ:** \`${sorted.length}\` ข้อความ\n` +
                                `- \`🕒\` **บันทึกเมื่อ:** <t:${Math.floor(Date.now() / 1000)}:R>`,
                        },
                        { type: 14, divider: false, spacing: 2 },
                        isPublicUrl
                            ? linkButtonRow('ดูบันทึกบทสนทนา')
                            : { type: 10, content: `🔗 **ลิงก์บันทึก:** ${url}` },
                    ],
                },
            ],
        });

        return interaction.editReply({
            flags: 32768,
            components: [
                {
                    type: 17,
                    accent_color: COLORS.success,
                    components: [
                        { type: 10, content: `# ✅ ส่งบันทึกสำเร็จ\n- **ส่งลิงก์บันทึกไปที่ DM ของ** <@${ownerId}> **เรียบร้อยแล้ว**` },
                        { type: 14, divider: true, spacing: 1 },
                        {
                            type: 10,
                            content:
                                `- \`📁\` **ห้อง:** \`${channel.name}\`\n` +
                                `- \`💬\` **ข้อความ:** \`${sorted.length}\``,
                        },
                        { type: 14, divider: false, spacing: 2 },
                        isPublicUrl
                            ? linkButtonRow('เปิดดูบันทึก')
                            : {
                                type: 10,
                                content:
                                    `🔗 **ลิงก์บันทึก:** ${url}\n`
                            },
                    ],
                },
            ],
        });
    } catch (err) {
        console.error('Transcript error:', err.message);
        let fallbackUrl = null;
        try {
            const sortedMsgs = await fetchAllMessages(channel, 2000);

            const fallbackUserMap = {};
            interaction.guild.members.cache.forEach(m => {
                fallbackUserMap[m.id] = m.user.globalName || m.user.username;
            });
            interaction.guild.channels.cache.forEach(ch => { fallbackUserMap[ch.id] = ch.name; });
            interaction.guild.roles.cache.forEach(r => { fallbackUserMap[r.id] = r.name; });

            const ownerUser = await client.users.fetch(ownerId).catch(() => null);
            if (ownerUser) {
                const html = web.transcript({ channel, messages: sortedMsgs, owner: ownerUser, userMap: fallbackUserMap });
                const typeMatch = channel.name.match(/^ticket-(.+?)-\d+-/);
                const ticketType = typeMatch ? typeMatch[1] : 'unknown';
                const saved = saveTranscript({
                    html,
                    channelName: channel.name,
                    ownerTag: ownerUser.tag,
                    ownerId: ownerUser.id,
                    messageCount: sortedMsgs.length,
                    ticketType,
                });
                fallbackUrl = saved.url;
            }
        } catch (innerErr) {
            console.error('Fallback transcript save error:', innerErr.message);
        }

        if (fallbackUrl) {
            const isPublicUrl = fallbackUrl && !fallbackUrl.includes('localhost') && !fallbackUrl.includes('127.0.0.1');

            await channel.send({
                flags: 32768,
                components: [
                    {
                        type: 17,
                        accent_color: COLORS.warning,
                        components: [
                            {
                                type: 10,
                                content:
                                    `- \`⚠️\` **ส่ง DM ไม่สำเร็จ**\n` +
                                    `- **ไม่สามารถส่งลิงก์บันทึกไปหา** <@${ownerId}> **ได้** **(อาจปิดรับ DM จากเซิร์ฟเวอร์)**\n` +
                                    `- **แนบลิงก์ไว้ที่นี่แทน:**`,
                            },
                            { type: 14, divider: false, spacing: 1 },
                            isPublicUrl
                                ? {
                                    type: 1,
                                    components: [
                                        { type: 2, style: 5, label: 'เปิดดูบันทึกบทสนทนา', url: fallbackUrl },
                                    ],
                                }
                                : { type: 10, content: `🔗 ${fallbackUrl}` },
                        ],
                    },
                ],
            }).catch(e => console.error('Fallback channel send error:', e.message));

            return interaction.editReply({
                flags: 32768,
                components: [
                    {
                        type: 17,
                        accent_color: COLORS.warning,
                        components: [
                            {
                                type: 10,
                                content:
                                    `- \`⚠️\` **ส่ง DM ไม่สำเร็จ**\n` +
                                    `- **บันทึกถูกสร้างสำเร็จแล้ว แต่ส่งไปหา** <@${ownerId}> **ทาง DM** **ไม่ได้**\n` +
                                    `- **ได้แนบลิงก์ไว้ในห้องนี้แทนแล้ว**`,
                            },
                        ],
                    },
                ],
            });
        }

        return interaction.editReply({
            flags: 32768,
            components: [
                {
                    type: 17,
                    accent_color: COLORS.danger,
                    components: [
                        {
                            type: 10,
                            content:
                                `# ❌ สร้างบันทึกไม่สำเร็จ\n` +
                                `เกิดข้อผิดพลาดขณะสร้างหรือบันทึก Transcript\n` +
                                `> ${escapeHtml(err.message || 'unknown error')}`,
                        },
                    ],
                },
            ],
        });
    }
}

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'ticket-panel') {
                if (!OWNER_IDS.includes(interaction.user.id) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ เฉพาะแอดมินเท่านั้น', flags: 64 });
                }
                await interaction.channel.send(buildTicketPanel());
                return interaction.reply({ content: '✅ ส่งแผง Ticket สำเร็จ!', flags: 64 });
            }
        }

        if (interaction.isButton()) {
            if (interaction.customId === 'ticket_create') {
                const payload = buildTypeSelectMessage();
                payload.flags = 32768 | 64;
                return interaction.reply(payload);
            }
            if (interaction.customId === 'ticket_close') return closeTicket(interaction);
            if (interaction.customId === 'ticket_claim') return claimTicket(interaction);
            if (interaction.customId === 'ticket_transcript') return transcriptTicket(interaction);
            if (interaction.customId === 'ticket_my_list') return listMyTickets(interaction);
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'ticket_type_select') {
                const typeId = interaction.values[0];
                await interaction.deferUpdate();

                if (typeId === 'clear') {
                    const payload = buildTypeSelectMessage();
                    payload.flags = 32768 | 64;
                    return interaction.editReply(payload);
                }

                try {
                    const ticketChannel = await createTicketChannel(interaction, typeId);
                    await interaction.editReply({
                        flags: 32768 | 64,
                        components: [
                            {
                                type: 17,
                                accent_color: 0x000000,
                                components: [
                                    { type: 10, content: `# ✅ สร้าง Ticket สำเร็จ!\n**ห้องของคุณ: <#${ticketChannel.id}>**` }
                                ]
                            }
                        ]
                    });
                } catch (err) {
                    console.error('Create ticket error:', err);
                    await interaction.editReply({
                        flags: 32768 | 64,
                        components: [
                            {
                                type: 17,
                                accent_color: 0x000000,
                                components: [
                                    { type: 10, content: `# ❌ ไม่สามารถสร้าง Ticket ได้\n${err.message}` }
                                ]
                            }
                        ]
                    });
                }
            }
        }
    } catch (err) {
        console.error('Interaction error:', err);
        try {
            const errPayload = { content: '❌ เกิดข้อผิดพลาด', flags: 64 };
            if (interaction.deferred) {
                await interaction.editReply(errPayload);
            } else if (!interaction.replied) {
                await interaction.reply(errPayload);
            } else {
                await interaction.followUp(errPayload);
            }
        } catch (replyErr) {
            if (replyErr?.code !== 10062) {
                console.error('Reply error:', replyErr?.message);
            }
        }
    }
});

client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Ticket Bot online: ${c.user.tag}`);

    c.user.setPresence({
        activities: [{ name: SHOP_NAME, type: ActivityType.Watching }],
        status: 'online',
    });

    client.on('error', (err) => {
        if (err?.code === 10062) return;
        console.error('⚠️ Client error (non-fatal):', err.message);
    });

    try {
        const rest = new REST({ version: '10' }).setToken(TICKET_BOT_TOKEN);
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            {
                body: [
                    new SlashCommandBuilder()
                        .setName('ticket-panel')
                        .setDescription('ส่งแผงเปิด Ticket')
                        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                        .toJSON(),
                ]
            }
        );
        console.log('✅ Slash commands synced');
    } catch (err) {
        console.error('❌ Sync commands failed:', err.message);
    }
});

const app = express();

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.get('/transcript/:id', (req, res) => {
    const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(TRANSCRIPT_DIR, `${id}.html`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send(`<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 — Not Found</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐰</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;800&family=Baloo+2:wght@600;800&display=swap" rel="stylesheet">
<style>
    *{box-sizing:border-box}
    body{font-family:'Noto Sans Thai',-apple-system,sans-serif;color:#3a2a52;display:flex;align-items:center;justify-content:center;
        min-height:100vh;margin:0;text-align:center;padding:20px;
        background:linear-gradient(145deg,#ffd9ef 0%,#e3c9fb 45%,#bdeeff 100%)}
    .card{background:rgba(255,255,255,.85);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
        border:1px solid rgba(255,255,255,.7);border-radius:22px;padding:40px 36px;box-shadow:0 14px 34px rgba(168,110,200,.2)}
    .bunny{font-size:48px;margin-bottom:6px}
    .code{font-family:'Baloo 2',sans-serif;font-size:72px;font-weight:800;line-height:1;margin-bottom:10px;
        background:linear-gradient(90deg,#f472b6,#a78bfa 55%,#22d3ee);-webkit-background-clip:text;background-clip:text;color:transparent}
    h1{font-family:'Baloo 2',sans-serif;font-size:21px;margin-bottom:8px;color:#3a2a52}
    p{color:#8b78a8;font-size:14px}
    a{display:inline-block;margin-top:26px;background:linear-gradient(90deg,#f472b6,#a78bfa);color:#fff;padding:11px 28px;
        border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;box-shadow:0 6px 16px rgba(167,139,250,.35)}
</style></head>
<body><div class="card">
    <div class="bunny">🐰</div>
    <div class="code">404</div>
    <h1>ไม่พบ Transcript</h1>
    <p>ลิงก์นี้อาจหมดอายุ ถูกลบไปแล้ว หรือ ID ไม่ถูกต้อง</p>
    <a href="/">← กลับหน้าแรก</a>
</div></body></html>`);
    }
    res.sendFile(filePath);
});

app.get('/', (req, res) => {
    let data = { transcripts: [] };
    try { data = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8')); } catch { }
    res.send(web.index(data.transcripts));
});

app.listen(WEB_PORT, () => {
    console.log(`✅ Web server online: ${WEB_BASE_URL}`);
});

process.on('unhandledRejection', (err) => {
    if (err?.code === 10062) return;
    console.error('Unhandled rejection:', err);
});

client.login(TICKET_BOT_TOKEN).catch(err => {
    console.error('❌ Ticket bot login failed:', err.message);
    process.exit(1);
});
