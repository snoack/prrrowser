document.addEventListener("load", event =>
{
  let elem = event.target;
  let keywords = null;

  if (elem.localName == "img" && elem.src != elem._newSrc)
  {
    keywords = elem.alt || elem.title;
    if (!keywords)
    {
      let figure = elem.closest("figure");
      if (figure)
      {
        let figcaption = figure.querySelector("figcaption");
        if (figcaption)
          keywords = figcaption.textContent.trim();
      }
    }
  }

  if (keywords)
  {
    let origVisibilityValue = elem.style.getPropertyValue("visibility");
    let origVisibilityPriority = elem.style.getPropertyPriority("visibility");

    elem.style.setProperty("visibility", "hidden", "important");
   
    chrome.runtime.sendMessage(
      {
        type: "get-image",
        keywords,
        width: elem.width * window.devicePixelRatio,
        height: elem.height * window.devicePixelRatio
      },
      url =>
      {
        if (url)
        {
          elem.src = elem._newSrc = url;
          elem.removeAttribute("srcset");

          if (elem.parentElement && elem.parentElement.localName == "picture")
          {
            for (let i = 0; i < elem.parentElement.children.length; i++)
            {
              let sibling = elem.parentElement.children[i];
              if (sibling.localName == "source")
              {
                sibling.remove();
                i--;
              }
            }
          }
        }

        if (elem.style.getPropertyValue("visibility") == "hidden")
          elem.style.setProperty("visibility", origVisibilityValue,
                                               origVisibilityPriority);
      }
    );
  }
}, true);
