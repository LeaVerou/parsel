import {describe, expect, it} from '@jest/globals';
import {parse, specificity, tokenize} from './dist/parsel.js';

describe('`tokenize`', () => {
  it('should work', () => {
    expect(tokenize('#foo')).toMatchInlineSnapshot(`
      [
        {
          "content": "#foo",
          "name": "foo",
          "pos": [
            0,
            4,
          ],
          "type": "id",
        },
      ]
    `);
  });

  it('should work with empty selectors', () => {
    expect(tokenize('')).toMatchObject([]);
  });

  it('should work with multiple strings', () => {
    expect(tokenize('[data-test-id^="test-"]:not([data-test-id^="test-foo"])'))
      .toMatchInlineSnapshot(`
      [
        {
          "caseSensitive": undefined,
          "content": "[data-test-id^="test-"]",
          "name": "data-test-id",
          "namespace": undefined,
          "operator": "^=",
          "pos": [
            0,
            23,
          ],
          "type": "attribute",
          "value": ""test-"",
        },
        {
          "argument": "[data-test-id^="test-foo"]",
          "content": ":not([data-test-id^="test-foo"])",
          "name": "not",
          "pos": [
            23,
            55,
          ],
          "type": "pseudo-class",
        },
      ]
    `);
  });

  it('should work with multiple parentheses', () => {
    expect(
      tokenize(
        '[data-test-id^="test-"]:not([data-test-id^="test-foo"]) [data-test-id^="test-"]:not([data-test-id^="test-foo"])'
      )
    ).toMatchInlineSnapshot(`
      [
        {
          "caseSensitive": undefined,
          "content": "[data-test-id^="test-"]",
          "name": "data-test-id",
          "namespace": undefined,
          "operator": "^=",
          "pos": [
            0,
            23,
          ],
          "type": "attribute",
          "value": ""test-"",
        },
        {
          "argument": "[data-test-id^="test-foo"]",
          "content": ":not([data-test-id^="test-foo"])",
          "name": "not",
          "pos": [
            23,
            55,
          ],
          "type": "pseudo-class",
        },
        {
          "content": " ",
          "pos": [
            55,
            56,
          ],
          "type": "combinator",
        },
        {
          "caseSensitive": undefined,
          "content": "[data-test-id^="test-"]",
          "name": "data-test-id",
          "namespace": undefined,
          "operator": "^=",
          "pos": [
            56,
            79,
          ],
          "type": "attribute",
          "value": ""test-"",
        },
        {
          "argument": "[data-test-id^="test-foo"]",
          "content": ":not([data-test-id^="test-foo"])",
          "name": "not",
          "pos": [
            79,
            111,
          ],
          "type": "pseudo-class",
        },
      ]
    `);
  });
});

describe('`parse`', () => {
  it('should work', () => {
    expect(parse('#foo')).toMatchInlineSnapshot(`
      {
        "content": "#foo",
        "name": "foo",
        "pos": [
          0,
          4,
        ],
        "type": "id",
      }
    `);
  });

  it('should parse escapes correctly', () => {
    expect(parse('.mb-\\[max\\(-70\\%\\2c -23rem\\)\\]'))
      .toMatchInlineSnapshot(`
      {
        "combinator": " ",
        "left": {
          "content": ".mb-\\[max\\(-70\\%\\2c",
          "name": "mb-\\[max\\(-70\\%\\2c",
          "pos": [
            0,
            19,
          ],
          "type": "class",
        },
        "right": {
          "content": "-23rem\\)\\]",
          "name": "-23rem\\)\\]",
          "namespace": undefined,
          "pos": [
            20,
            30,
          ],
          "type": "type",
        },
        "type": "complex",
      }
    `);
  });

  it('should parse universal selectors', () => {
    expect(parse('*')).toMatchInlineSnapshot(`
      {
        "content": "*",
        "namespace": undefined,
        "pos": [
          0,
          1,
        ],
        "type": "universal",
      }
    `);
    expect(parse('html|*')).toMatchInlineSnapshot(`
      {
        "content": "html|*",
        "namespace": "html",
        "pos": [
          0,
          6,
        ],
        "type": "universal",
      }
    `);
  });

  it('should parse indexed pseudo-classes', () => {
    expect(parse('div:nth-child(2n+1 of #someId.someClass)'))
      .toMatchInlineSnapshot(`
      {
        "list": [
          {
            "content": "div",
            "name": "div",
            "namespace": undefined,
            "pos": [
              0,
              3,
            ],
            "type": "type",
          },
          {
            "argument": "2n+1 of #someId.someClass",
            "content": ":nth-child(2n+1 of #someId.someClass)",
            "index": "2n+1",
            "name": "nth-child",
            "pos": [
              3,
              40,
            ],
            "subtree": {
              "list": [
                {
                  "content": "#someId",
                  "name": "someId",
                  "pos": [
                    0,
                    7,
                  ],
                  "type": "id",
                },
                {
                  "content": ".someClass",
                  "name": "someClass",
                  "pos": [
                    7,
                    17,
                  ],
                  "type": "class",
                },
              ],
              "type": "compound",
            },
            "type": "pseudo-class",
          },
        ],
        "type": "compound",
      }
    `);
  });

  it('should not work with empty selectors', () => {
    expect(() => parse('')).toThrowErrorMatchingInlineSnapshot(
      '"Could not build AST."'
    );
  });
});

describe('`specificity`', () => {
  it('should work', () => {
    expect(specificity('div:nth-child(2n+1 of #someId.someClass)'))
      .toMatchInlineSnapshot(`
      [
        1,
        2,
        1,
      ]
    `);
  });
});
