import { getMetadata } from '../../scripts/aem.js';
import { isAuthorEnvironment, moveInstrumentation } from '../../scripts/scripts.js';

/**
 *
 * @param {Element} block
 */
export default async function decorate(block) {
  const aemAuthorUrl = getMetadata('authorUrl') || window.GLOBALS?.DEFAULT_AEM_AUTHOR_URL;
  const aemPublishUrl = getMetadata('publishUrl') || window.GLOBALS?.DEFAULT_AEM_PUBLISH_URL;
  const persistedQuery = '/graphql/execute.json/altria/announcementByPath';

  const contentPath = block.querySelector(':scope div:nth-child(1) > div a')?.textContent?.trim();

  const variationName =
    block
      .querySelector(':scope div:nth-child(2) > div')
      ?.textContent?.trim()
      ?.toLowerCase()
      ?.replace(' ', '_') || 'master';

  
  block.innerHTML = ``;

  const isAuthor = isAuthorEnvironment();
  const url = window?.location?.origin?.includes('author')
    ? `${aemAuthorUrl}${persistedQuery};path=${contentPath};variation=${variationName};ts=${
        Math.random() * 1000
      }`
    : `${aemPublishUrl}${persistedQuery};path=${contentPath};variation=${variationName};ts=${
        Math.random() * 1000
      }`;
  const options = { credentials: 'include' };

  const cfReq = await fetch(url, options)
    .then((response) => response.json())
    .then((contentfragment) => {
      let data = '';
      if (contentfragment.data) {
        data = contentfragment.data[Object.keys(contentfragment.data)[0]].item;
      }
      return data;
    });
  const itemId = `urn:aemconnection:${contentPath}/jcr:content/data/${variationName}`;

  block.setAttribute('data-aue-type', 'container');

  block.innerHTML = `
  <div class='banner-content block' data-aue-resource=${itemId} data-aue-label="content fragment" data-aue-type="reference" data-aue-filter="cf">
		<div class='banner-detail' style="background-image: linear-gradient(90deg,rgba(0,0,0,0.6), rgba(0,0,0,0) 80%) ,url(${aemAuthorUrl + cfReq.heroImage?._path});">
          <p data-aue-prop="subject" data-aue-label="subject" data-aue-type="text" class='subject'>${
            cfReq?.subject
          }</p>
          <p data-aue-prop="pretitle" data-aue-label="pretitle" data-aue-type="text" class='headline'>${
            cfReq?.audiences[0].audienceType
          }</p>
          <p data-aue-prop="detail" data-aue-label="detail" data-aue-type="richtext" class='detail'>${
            cfReq?.atAGlance?.html
          }</p>
          <p data-aue-prop="channels" data-aue-label="channels" class='channels'>${
            cfReq?.channels
          }</p>
          <p data-aue-prop="sections-0" data-aue-label="sections-0" class='sections'>${
            cfReq?.sections[0].label
            cfReq?.sections[0].body?.html
          }</p>
      </div>
      <div class='banner-logo'>
      </div>
  </div>
	`;
  //renderFragment(cfReq, block);

  if (!isAuthor) {
    moveInstrumentation(block, null);
    block.querySelectorAll('*').forEach((elem) => moveInstrumentation(elem, null));
  }
}

// Helper function to check if object is a nested fragment
function isNestedFragment(obj) {
  return obj && typeof obj === 'object' && '_path' in obj && ('body' in obj || 'label' in obj);
}

// Recursively render CF or nested fragment
function renderFragment(data, parentDiv, visited = new Set(), depth = 0) {
  if (visited.has(data)) return;
  visited.add(data);
  if (depth > 20) return; // Prevent stack overflow

  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        const arrDiv = document.createElement('div');
        arrDiv.innerHTML = `<strong>${key}[${idx}]:</strong>`;
        if (isNestedFragment(item) || typeof item === 'object') {
          renderFragment(item, arrDiv, visited, depth + 1);
        } else {
          arrDiv.innerHTML += ` ${item}`;
        }
        parentDiv.appendChild(arrDiv);
      });
    }
    else if (isNestedFragment(value)) {
      const nestedDiv = document.createElement('div');
      nestedDiv.innerHTML = `<strong>${key} (nested fragment):</strong>`;
      renderFragment(value, nestedDiv, visited, depth + 1);
      parentDiv.appendChild(nestedDiv);
    }
    else if (value && typeof value === 'object' && 'html' in value) {
      const div = document.createElement('div');
      div.innerHTML = `<strong>${key}:</strong> ${value.html}`;
      parentDiv.appendChild(div);
    }
    else if (key === '_path' && value.includes('all-pm-usa-usstc-jmc-helix-and-njoy-direct-customers')) {
      const div = document.createElement('div');
      div.innerHTML = `<strong>Audience:</strong> All PM USA, USSTC, JMC, Helix, and NJOY Direct Customers`;
      parentDiv.appendChild(div);
    }
    else if (key !== '_path') {
      const div = document.createElement('div');
      div.innerHTML = `<strong>${key}:</strong> ${value}`;
      parentDiv.appendChild(div);
    }
  });
}