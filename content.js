document.addEventListener("load", event =>
{
  let elem = event.target;
  if (elem.localName == "img" && elem.alt && !elem._replaced)
  {
    let origVisibilityValue = elem.style.getPropertyValue("visibility");
    let origVisibilityPriority = elem.style.getPropertyPriority("visibility");

    elem.style.setProperty("visibility", "hidden", "important");
   
    chrome.runtime.sendMessage(
      {
        keywords: elem.alt,
        width: elem.naturalWidth,
        height: elem.naturalHeight
      },
      url =>
      {
        if (url)
        {
          elem.src = url;
          elem._replaced = true;
        }

        elem.style.setProperty("visibility", origVisibilityValue,
                                             origVisibilityPriority);
      }
    );
  }
}, true);
