import {describe, expect, it} from '@jest/globals';
import {parse, specificity, tokenize} from './dist/parsel.js';

describe('Token', () => {
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
});

describe('AST', () => {
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

  it('should parse index pseudo-classes', () => {
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
});

describe('Specificity', () => {
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
