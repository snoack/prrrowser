let dogsCheckBox = document.querySelector("input[name=dogs]");
let lowResCheckBox = document.querySelector("input[name=lowres]");
let disabledCheckBox = document.querySelector("input[name=disabled]");
let disabledOption = document.getElementById("disabled-option");
let disabledLabel = document.getElementById("disabled-label");
let disabledKey = null;

function updateDogsCheckBox(topic)
{
  dogsCheckBox.checked = topic == "dogs";
}

chrome.storage.local.get(["topic", "lowres"], items =>
{
  updateDogsCheckBox(items.topic);
  lowResCheckBox.checked = !!items.lowres;
});

chrome.storage.onChanged.addListener(changes =>
{
  if ("topic" in changes)
    updateDogsCheckBox(changes.topic.newValue);

  if ("lowres" in changes)
    lowResCheckBox.checked = !!changes.lowres.newValue;

  if (disabledKey && disabledKey in changes)
    disabledCheckBox.checked = !!changes[disabledKey].newValue;
});

dogsCheckBox.addEventListener("change", () =>
{
  if (dogsCheckBox.checked)
    chrome.storage.local.set({topic: "dogs"});
  else
    chrome.storage.local.remove("topic");
});

lowResCheckBox.addEventListener("change", () =>
{
  chrome.storage.local.set({lowres: lowResCheckBox.checked});
});

disabledCheckBox.addEventListener("change", () =>
{
  if (disabledCheckBox.checked)
    chrome.storage.local.set({[disabledKey]: true});
  else
    chrome.storage.local.remove(disabledKey);
});

function queryDisabledState()
{
  chrome.runtime.sendMessage({type: "get-last-host"}, lastHost =>
  {
    if (lastHost)
    {
      disabledOption.hidden = false;
      disabledLabel.textContent = "Disable on " + lastHost;
      disabledKey = "disabled:" + lastHost;
      chrome.storage.local.get(disabledKey, items =>
      {
        disabledCheckBox.checked = !!items[disabledKey];
      });
    }
    else
    {
      disabledOption.hidden = true;
      disabledKey = null;
    }
  });
}

document.addEventListener("visibilitychange", () =>
{
  if (!document.hidden)
    queryDisabledState();
});

queryDisabledState();
