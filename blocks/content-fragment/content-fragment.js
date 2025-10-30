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

  const sectionsHtml = (cfReq?.section || []).map((section, idx) => `
    <p data-aue-label="sections-${idx}" class='sections'>${section.label}</p>
    <p data-aue-label="sections-${idx}-body" class='sections'>${section.body?.html}</p>
    `).join('');

  const audiencesHtml = (cfReq?.audiences || []).map((audience, idx) => {
    let audienceLabel;

    if (audience._path.includes('all-pm-usa-usstc-jmc-helix-and-njoy-direct-customers')) {
        audienceLabel = 'All PM USA, USSTC, JMC, Helix, and NJOY Direct Customers';
    } else if (audience._path.includes('all-jmc-direct-customers')) {
        audienceLabel = 'All JMC Direct Customers';
    } else if (audience._path.includes('all-pm-usa-direct-customers')) {
        audienceLabel = 'All PM USA Direct Customers';
    } else if (audience._path.includes('usstc-retail-excluding-ma-nj')) {
        audienceLabel = 'All USSTC Retail Contracted Stores Excluding MA and NJ';
    } else {
        audienceLabel = 'General Audience'; // Fallback value
    }

    return `<p data-aue-label="audiences-${idx}" class='audiences'>${audienceLabel}</p>`;
  }).join('');

  const brandsInAudiencesHtml = (cfReq?.audiences[0].brands || []).map((brand, idx) => {
    let brandsLabel;

    if (brand._path.includes('njoy')) {
        brandsLabel = 'NJOY';
    } else if (brand._path.includes('helix-innovations')) {
        brandsLabel = 'Helix Innovations';
    } else if (brand._path.includes('john-middleton-company')) {
        brandsLabel = 'John Middleton Company';
    } else if (brand._path.includes('philip-morris-usa')) {
        brandsLabel = 'Philip Morris USA';
    } else if (brand._path.includes('us-smokeless-tobacco-company')) {
        brandsLabel = 'US Smokeless Tobacco Company';
    }

    return `<p data-aue-label="brands-${idx}" class='brands'>&nbsp;&nbsp;${brandsLabel}</p>`;
  }).join('');

  block.innerHTML = `
    <div class='banner-content block' data-aue-resource=${itemId} data-aue-label="Announcement CF" data-aue-type="reference" data-aue-filter="cf">
		<div class='banner-detail' style="background-image: linear-gradient(90deg,rgba(0,0,0,0), rgba(0,0,0,0) 80%) ,url(${aemAuthorUrl + cfReq?.heroImage?._path});">
          <strong>Subject:</strong><p data-aue-prop="subject" data-aue-label="Subject" data-aue-type="text" class='subject'>${
            cfReq?.subject
          }</p>
          <strong>Audiences:</strong>
          <div>
            ${audiencesHtml}
            <p>&nbsp;&nbsp;<strong>Brands:</strong> ${brandsInAudiencesHtml}</p>
          </div>
          <strong>At a Glance:</strong><div data-aue-prop="atAGlance" data-aue-label="At a Glance" data-aue-filter="text" data-aue-type="richtext" class='detail'>${
            cfReq?.atAGlance?.html
          }</div>
          <strong>Channel(s):</strong><p data-aue-prop="channels" data-aue-label="channels" class='channels'>${
            cfReq?.channels
          }</p>
          <strong>Sections:</strong>
          <div>
            ${sectionsHtml}
          </div>
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