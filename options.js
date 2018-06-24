let checkbox = document.querySelector("input[name=dogs]");

chrome.storage.local.get("topic", items =>
{
  checkbox.checked = items.topic == "dogs";
});

checkbox.addEventListener("change", event =>
{
  if (checkbox.checked)
    chrome.storage.local.set({topic: "dogs"});
  else
    chrome.storage.local.remove("topic");
});
