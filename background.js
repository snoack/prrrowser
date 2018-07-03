const CACHE_SIZE = 750;
const DEFAULT_TOPIC = "cats";

let cache = new Map();
let topic = DEFAULT_TOPIC;
let lowRes = false;
let whitelist = new Set();
let lastHost = null;

function normalizeKeywords(keywords)
{
  return keywords.toLowerCase().replace(/[^a-z0-9\u0080-\uFFFF]+/g, " ").trim();
}

function loadImage(url)
{
  return new Promise((resolve, reject) =>
  {
    let image = new Image();
    image.addEventListener("load", () => { resolve(image); });
    image.addEventListener("error", reject);
    image.src = url;
  });
}

function findImage(keywords, format)
{
  return fetch("https://www.google.com/search?tbm=isch" +
               "&q=" + encodeURIComponent(keywords + " " + topic) +
               "&tbs=iar:" + format, {
                 headers: {
                   "user-agent": navigator.userAgent.replace(/Android [\d.]+; Mobile/, "")
                 }
               })
    .then(response => response.text())
    .then(source =>
    {
      let parser = new DOMParser();
      let doc = parser.parseFromString(source, "text/html");
      let {ou, tu} = JSON.parse(doc.querySelector(".rg_meta").textContent);

      if (lowRes)
        return loadImage(tu);

      return loadImage(ou).catch(() => loadImage(tu));
    });
}

function findImageCached(keywords, format)
{
  let key = format + ":" + keywords;
  let entry = cache.get(key);
  let promise;

  if (!entry)
  {
    promise = findImage(keywords, format);
    entry = {promise, url: null};

    promise.then(
      image => {
        entry.url = image.src;
        entry.promise = null;
      },
      error => {
        cache.delete(key);
      }
    );

    while (cache.size >= CACHE_SIZE)
      cache.delete(cache.keys().next().value);
  }
  else
  {
    promise = entry.promise || loadImage(entry.url);
    cache.delete(key);
  }

  cache.set(key, entry);
  return promise;
}

function getScaledImage(keywords, width, height)
{
  let dRatio = width / height;
  let format = dRatio < 0.85 ? "t" :
               dRatio < 1.15 ? "s" :
               dRatio < 2.00 ? "w" : "xw";

  return findImageCached(keywords, format).then(
    image =>
    {
      let dWidth = width;
      let dHeight = height;
      let sRatio = image.width / image.height;
      if (sRatio > dRatio)
        dHeight = dWidth / sRatio;
      else
        dWidth = dHeight * sRatio;

      let canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(
        image,
        0,
        0,
        image.width,
        image.height,
        (width - dWidth) / 2,
        (height - dHeight) / 2,
        dWidth,
        dHeight
      );

      return canvas.toDataURL("image/png");
    },
    () => null
  );
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) =>
{
  switch (msg.type)
  {
    case "get-image":
      if (whitelist.has(new URL(sender.tab.url).host))
      {
        sendResponse(null);
        return false;
      }

      getScaledImage(normalizeKeywords(msg.keywords),
                     msg.width, msg.height).then(sendResponse);
      return true;

    case "get-last-host":
      sendResponse(lastHost);
      return false;
  }
});

function updateContextMenu()
{
  chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs =>
  {
    let url = null;
    let host = null;

    if (tabs.length > 0)
    {
      let protocol;

      ({url} = tabs[0]);
      ({protocol, host} = new URL(url));

      if (protocol != "https:" && protocol != "http:")
        host = null;
    }

    if ("contextMenus" in chrome)
    {
      chrome.contextMenus.removeAll();

      if (host)
      {
        chrome.contextMenus.create({
          type: "checkbox",
          checked: whitelist.has(host),
          title: "Disable on " + host,
          contexts: ["browser_action"],
          onclick(details)
          {
            let key = "disabled:" + host;
            if (details.checked)
              chrome.storage.local.set({[key]: true});
            else
              chrome.storage.local.remove(key);
          }
        });
      }

      chrome.contextMenus.create({
        id: "dogs",
        type: "checkbox",
        checked: topic == "dogs",
        title: "Show dogs",
        contexts: ["browser_action"],
        onclick(details)
        {
          if (details.checked)
            chrome.storage.local.set({topic: "dogs"});
          else
            chrome.storage.local.remove("topic");
        }
      });
    }
    else if (url != "about:addons")
    {
      lastHost = host;
    }
  });
}

chrome.tabs.onActivated.addListener(updateContextMenu);

if ("windows" in chrome)
{
  chrome.windows.onFocusChanged.addListener(windowId =>
  {
    if (windowId != chrome.windows.WINDOW_ID_NONE)
      updateContextMenu();
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) =>
{
  if ("url" in changeInfo && tab.active)
    updateContextMenu();
});

function processStorageItem(key, value)
{
  if (key == "topic")
  {
    topic = value || DEFAULT_TOPIC;
    cache.clear();
  }
  else if (key == "lowres")
  {
    lowRes = value;
    cache.clear();
  }
  else if (key.startsWith("disabled:"))
  {
    let host = key.substr(9);
    if (value)
      whitelist.add(host);
    else
      whitelist.remove(host);
  }
}

chrome.storage.local.get(null, items =>
{
  for (let key in items)
    processStorageItem(key, items[key]);
  updateContextMenu();

  if (!("lowres" in items))
  {
    chrome.runtime.getPlatformInfo(info =>
    {
      if (info.os == "android")
        chrome.storage.local.set({lowres: true});
    });
  }
});

chrome.storage.onChanged.addListener(changes =>
{
  for (let key in changes)
    processStorageItem(key, changes[key].newValue);
  updateContextMenu();
});

if (!("contextMenus" in chrome))
{
  chrome.browserAction.onClicked.addListener(() =>
  {
    chrome.runtime.openOptionsPage();
  });
}

chrome.webRequest.onHeadersReceived.addListener(
  details =>
  {
    if (document.location.href == details.originUrl ||
        document.location.origin == details.initiator)
    {
      let headers = [];

      for (let header of details.responseHeaders)
      {
        if (header.name.toLowerCase() != "cache-control")
          headers.push(header);
      }

      headers.push({name: "Cache-Control", value: "max-age=31536000"});
      return {responseHeaders: headers};
    }
  },
  {"urls": ["<all_urls>"], "types": ["image"]},
  ["blocking", "responseHeaders"]
);
