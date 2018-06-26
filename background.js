const CACHE_SIZE = 150;
const DEFAULT_TOPIC = "cats";

let cache = new Map();
let topic, whitelist;

function loadImage(keywords)
{
  return fetch("https://www.google.com/search?tbm=isch&q=" +
               encodeURIComponent(keywords + " " + topic))
    .then(response => response.text())
    .then(source =>
    {
      let parser = new DOMParser();
      let doc = parser.parseFromString(source, "text/html");

      return new Promise((resolve, reject) =>
      {
        let image = new Image();
        image.addEventListener("load", () =>
        {
          resolve(image);
        });
        image.addEventListener("error", () =>
        {
          let thumbnail = new Image();
          thumbnail.addEventListener("load", () =>
          {
            resolve(thumbnail);
          });
          thumbnail.addEventListener("error", reject);
          thumbnail.src = doc.querySelector("#search img").src;
        });
        image.src = JSON.parse(doc.querySelector(".rg_meta").textContent).ou;
      });
    });
}

function loadImageCached(keywords)
{
  let promise = cache.get(keywords);

  if (!promise)
  {
    promise = loadImage(keywords).catch(error =>
    {
      cache.delete(keywords);
      throw error;
    });

    while (cache.size >= CACHE_SIZE)
      cache.delete(cache.keys().next().value);
  }
  else
  {
    cache.delete(keywords);
  }
  cache.set(keywords, promise);

  return promise;
}

function getScaledImage(keywords, width, height)
{
  return loadImageCached(keywords).then(
    image =>
    {
      let dWidth = width;
      let dHeight = height;
      let ratio = image.width / image.height;
      if (ratio > dWidth / dHeight)
        dHeight = dWidth / ratio;
      else
        dWidth = dHeight * ratio;

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
  if (whitelist.has(new URL(sender.tab.url).host))
  {
    sendResponse(null);
    return false;
  }

  getScaledImage(msg.keywords, msg.width, msg.height).then(sendResponse);
  return true;
});

function updateContextMenu()
{
  chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs =>
  {
    chrome.contextMenus.removeAll();

    if (tabs.length > 0)
    {
      let {protocol, host} = new URL(tabs[0].url);

      if (protocol == "https:" || protocol == "http:")
      {
        chrome.contextMenus.create({
          type: "checkbox",
          checked: whitelist.has(host),
          title: "Disable on " + host,
          contexts: ["browser_action"],
          onclick(details)
          {
            if (details.checked)
              whitelist.add(host);
            else
              whitelist.delete(host);
            chrome.storage.local.set({whitelist: Array.from(whitelist)});
          }
        });
      }
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
  });
}

chrome.tabs.onActivated.addListener(updateContextMenu);

chrome.windows.onFocusChanged.addListener(windowId =>
{
  if (windowId != chrome.windows.WINDOW_ID_NONE)
    updateContextMenu();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) =>
{
  if ("url" in changeInfo && tab.active)
    updateContextMenu();
});

chrome.storage.local.get(["topic", "whitelist"], items =>
{
  topic = items.topic || DEFAULT_TOPIC;
  whitelist = new Set(items.whitelist);
  updateContextMenu();
});

chrome.storage.onChanged.addListener(changes =>
{
  if (changes.topic)
  {
    topic = changes.topic.newValue || DEFAULT_TOPIC;
    cache.clear();
    updateContextMenu();
  }
});
