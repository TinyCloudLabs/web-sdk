import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  // By default, Docusaurus generates a sidebar from the docs folder structure
  mainSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Web SDK',
      link: {
        type: 'doc',
        id: 'web-sdk/index',
      },
      items: [
        {
          type: 'category',
          label: 'Guides',
          link: {
            type: 'doc',
            id: 'web-sdk/guides/index',
          },
          items: [
            'web-sdk/guides/getting-started',
            'web-sdk/guides/storage-guide',
            'web-sdk/guides/authentication-guide',
          ],
        },
        {
          type: 'category',
          label: 'API Reference',
          link: {
            type: 'doc',
            id: 'web-sdk/api/index',
          },
          items: [
            'web-sdk/api/keplerstorage',
            'web-sdk/api/userauthorization',
          ],
        },
      ],
    },
  ],
};

export default sidebars;
