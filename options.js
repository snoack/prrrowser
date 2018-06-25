let checkbox = document.querySelector("input[name=dogs]");

function updateCheckBox(topic)
{
  checkbox.checked = topic == "dogs";
}

chrome.storage.local.get("topic", items =>
{
  updateCheckBox(items.topic);
});

chrome.storage.onChanged.addListener(change =>
{
  if (change.topic)
    updateCheckBox(change.topic.newValue);
});

checkbox.addEventListener("change", event =>
{
  if (checkbox.checked)
    chrome.storage.local.set({topic: "dogs"});
  else
    chrome.storage.local.remove("topic");
});
