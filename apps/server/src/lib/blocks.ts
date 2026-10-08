import {
  Block,
  IdType,
  generateId,
  generateFractionalIndex,
} from '@colanode/core';

export const generateWelcomePageBlocks = (
  pageId: string
): Record<string, Block> => {
  const headingBlock: Block = {
    id: generateId(IdType.Block),
    type: 'heading1',
    parentId: pageId,
    index: generateFractionalIndex(),
    content: [{ type: 'text', text: 'Welcome to the Colanode!' }],
  };

  const colanodeParagraphBlock: Block = {
    id: generateId(IdType.Block),
    type: 'paragraph',
    parentId: pageId,
    index: generateFractionalIndex(headingBlock.index),
    content: [
      {
        type: 'text',
        text: 'Colanode is an open-source and local-first collaboration workspace.',
      },
    ],
  };

  const startTypingParagraphBlock: Block = {
    id: generateId(IdType.Block),
    type: 'paragraph',
    parentId: pageId,
    index: generateFractionalIndex(colanodeParagraphBlock.index),
    content: [
      {
        type: 'text',
        text: 'You can click anywhere and start typing. Here are a few tips to get you started:',
      },
    ],
  };

  const taskListBlock: Block = {
    id: generateId(IdType.Block),
    type: 'taskList',
    parentId: pageId,
    index: generateFractionalIndex(startTypingParagraphBlock.index),
    content: [],
  };

  const task1Block: Block = {
    id: generateId(IdType.Block),
    type: 'taskItem',
    parentId: taskListBlock.id,
    index: generateFractionalIndex(),
    attrs: {
      checked: false,
    },
  };

  const task1ParagraphBlock: Block = {
    id: generateId(IdType.Block),
    type: 'paragraph',
    parentId: task1Block.id,
    index: generateFractionalIndex(),
    content: [
      {
        text: 'Type "/" to see the menu of possible content you can add - headings, paragraphs, blockquotes, todos etc.',
        type: 'text',
      },
    ],
  };

  const task2Block: Block = {
    id: generateId(IdType.Block),
    type: 'taskItem',
    parentId: taskListBlock.id,
    index: generateFractionalIndex(task1Block.index),
    attrs: {
      checked: false,
    },
  };

  const task2ParagraphBlock: Block = {
    id: generateId(IdType.Block),
    type: 'paragraph',
    parentId: task2Block.id,
    index: generateFractionalIndex(),
    content: [
      {
        text: 'Highlight any text and use the menu to style your text in different ',
        type: 'text',
      },
      {
        text: 'formats',
        type: 'text',
        marks: [
          {
            type: 'bold',
          },
          {
            type: 'italic',
          },
        ],
      },
      {
        text: ' or ',
        type: 'text',
      },
      {
        text: 'colors',
        type: 'text',
        marks: [
          {
            type: 'highlight',
            attrs: {
              highlight: 'blue',
            },
          },
        ],
      },
      {
        text: ' ',
        type: 'text',
      },
      {
        text: '(not this)',
        type: 'text',
        marks: [
          {
            type: 'strike',
          },
        ],
      },
    ],
  };

  const task3Block: Block = {
    id: generateId(IdType.Block),
    type: 'taskItem',
    parentId: taskListBlock.id,
    index: generateFractionalIndex(task2Block.index),
    attrs: {
      checked: false,
    },
  };

  const task3ParagraphBlock: Block = {
    id: generateId(IdType.Block),
    type: 'paragraph',
    parentId: task3Block.id,
    index: generateFractionalIndex(),
    content: [
      {
        text: 'Use the drag icon on the left to reorder the content',
        type: 'text',
      },
    ],
  };

  const task4Block: Block = {
    id: generateId(IdType.Block),
    type: 'taskItem',
    parentId: taskListBlock.id,
    index: generateFractionalIndex(task3Block.index),
    attrs: {
      checked: false,
    },
  };

  const task4ParagraphBlock: Block = {
    id: generateId(IdType.Block),
    type: 'paragraph',
    parentId: task4Block.id,
    index: generateFractionalIndex(),
    content: [
      {
        text: "Add subpages, subfolders or databases using the '/' menu",
        type: 'text',
      },
    ],
  };

  const databaseHeadingBlock: Block = {
    id: generateId(IdType.Block),
    type: 'heading2',
    parentId: pageId,
    index: generateFractionalIndex(taskListBlock.index),
    content: [{ type: 'text', text: 'What is a Database?' }],
  };

  const databaseParagraphBlock: Block = {
    id: generateId(IdType.Block),
    type: 'paragraph',
    parentId: pageId,
    index: generateFractionalIndex(databaseHeadingBlock.index),
    content: [
      {
        text: 'A database in Colanode is like a powerful spreadsheet that combines tables with rich content. You can use databases to organize and view your information in multiple ways - as tables, kanban boards, calendars, or galleries. Each row in the database is a full page that can contain any type of content, and columns act as properties that help you organize and filter your information.',
        type: 'text',
      },
    ],
  };

  const databaseParagraphBlock2: Block = {
    id: generateId(IdType.Block),
    type: 'paragraph',
    parentId: pageId,
    index: generateFractionalIndex(databaseParagraphBlock.index),
    content: [
      {
        text: 'You can create a database by using the "/" menu inside an existing page. You can also create a database by clicking the three dots button in the sidebar near the spaces menu.',
        type: 'text',
      },
    ],
  };

  const blockquoteBlock: Block = {
    id: generateId(IdType.Block),
    type: 'blockquote',
    parentId: pageId,
    index: generateFractionalIndex(databaseParagraphBlock2.index),
  };

  const blockquoteParagraphBlock: Block = {
    id: generateId(IdType.Block),
    type: 'paragraph',
    parentId: blockquoteBlock.id,
    index: generateFractionalIndex(),
    content: [
      {
        text: 'Every journey starts with a single step. Block by block, you can build your own world.',
        type: 'text',
      },
    ],
  };

  const followUsHeadingBlock: Block = {
    id: generateId(IdType.Block),
    type: 'heading2',
    parentId: pageId,
    index: generateFractionalIndex(blockquoteBlock.index),
    content: [{ type: 'text', text: 'Follow Us' }],
  };

  const followUsParagraphBlock: Block = {
    id: generateId(IdType.Block),
    type: 'paragraph',
    parentId: pageId,
    index: generateFractionalIndex(followUsHeadingBlock.index),
    content: [
      {
        text: 'Stay updated with our latest developments on ',
        type: 'text',
      },
      {
        text: 'X (Twitter)',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              rel: 'noopener noreferrer nofollow',
              href: 'https://x.com/colanode',
              target: '_blank',
            },
          },
        ],
      },
      {
        text: '. Join our open-source community and contribute your ideas on ',
        type: 'text',
      },
      {
        text: 'GitHub',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              rel: 'noopener noreferrer nofollow',
              href: 'https://github.com/colanode/colanode',
              target: '_blank',
            },
          },
        ],
      },
      {
        text: ' - we welcome all contributions!',
        type: 'text',
      },
    ],
  };

  const result: Record<string, Block> = {
    [headingBlock.id]: headingBlock,
    [colanodeParagraphBlock.id]: colanodeParagraphBlock,
    [startTypingParagraphBlock.id]: startTypingParagraphBlock,
    [taskListBlock.id]: taskListBlock,
    [task1Block.id]: task1Block,
    [task1ParagraphBlock.id]: task1ParagraphBlock,
    [task2Block.id]: task2Block,
    [task2ParagraphBlock.id]: task2ParagraphBlock,
    [task3Block.id]: task3Block,
    [task3ParagraphBlock.id]: task3ParagraphBlock,
    [task4Block.id]: task4Block,
    [task4ParagraphBlock.id]: task4ParagraphBlock,
    [databaseHeadingBlock.id]: databaseHeadingBlock,
    [databaseParagraphBlock.id]: databaseParagraphBlock,
    [databaseParagraphBlock2.id]: databaseParagraphBlock2,
    [blockquoteBlock.id]: blockquoteBlock,
    [blockquoteParagraphBlock.id]: blockquoteParagraphBlock,
    [followUsHeadingBlock.id]: followUsHeadingBlock,
    [followUsParagraphBlock.id]: followUsParagraphBlock,
  };

  return result;
};

export const generateInitialMessageBlocks = (
  messageId: string
): Record<string, Block> => {
  const messageBlock: Block = {
    id: generateId(IdType.Block),
    type: 'paragraph',
    parentId: messageId,
    index: generateFractionalIndex(),
    content: [
      {
        type: 'text',
        text: 'Welcome to the channel! This is the beginning of your conversation. Feel free to start discussing, sharing ideas, or asking questions.',
      },
    ],
  };

  return { [messageBlock.id]: messageBlock };
};

export const markdownToBlocks = (
  parentId: string,
  markdown: string,
  startIndex?: string
): Record<string, Block> => {
  const blocks: Record<string, Block> = {};
  let prevIndex: string | undefined = startIndex;

  const lines = markdown.split('\n');
  let i = 0;

  let activeTaskList: Block | null = null;

  while (i < lines.length) {
    const rawLine = lines[i]!;

    // 1. Code blocks (```language ... ```)
    if (rawLine.trim().startsWith('```')) {
      activeTaskList = null;
      const lang = rawLine.trim().slice(3).trim();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++; // Skip closing ```

      const blockId = generateId(IdType.Block);
      const index = generateFractionalIndex(prevIndex);
      prevIndex = index;

      blocks[blockId] = {
        id: blockId,
        type: 'codeBlock',
        parentId,
        index,
        attrs: lang ? { language: lang } : null,
        content: [{ type: 'text', text: codeLines.join('\n') }],
      };
      continue;
    }

    const trimmed = rawLine.trim();

    // 2. Empty lines
    if (!trimmed) {
      activeTaskList = null;
      i++;
      continue;
    }

    // 3. Headings
    if (trimmed.startsWith('# ')) {
      activeTaskList = null;
      const blockId = generateId(IdType.Block);
      const index = generateFractionalIndex(prevIndex);
      prevIndex = index;

      blocks[blockId] = {
        id: blockId,
        type: 'heading1',
        parentId,
        index,
        content: parseInlineLeaves(trimmed.slice(2)),
      };
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      activeTaskList = null;
      const blockId = generateId(IdType.Block);
      const index = generateFractionalIndex(prevIndex);
      prevIndex = index;

      blocks[blockId] = {
        id: blockId,
        type: 'heading2',
        parentId,
        index,
        content: parseInlineLeaves(trimmed.slice(3)),
      };
      i++;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      activeTaskList = null;
      const blockId = generateId(IdType.Block);
      const index = generateFractionalIndex(prevIndex);
      prevIndex = index;

      blocks[blockId] = {
        id: blockId,
        type: 'heading3',
        parentId,
        index,
        content: parseInlineLeaves(trimmed.slice(4)),
      };
      i++;
      continue;
    }

    // 4. Blockquotes
    if (trimmed.startsWith('> ') || trimmed === '>') {
      activeTaskList = null;
      const blockquoteId = generateId(IdType.Block);
      const index = generateFractionalIndex(prevIndex);
      prevIndex = index;

      blocks[blockquoteId] = {
        id: blockquoteId,
        type: 'blockquote',
        parentId,
        index,
      };

      const innerParagraphId = generateId(IdType.Block);
      blocks[innerParagraphId] = {
        id: innerParagraphId,
        type: 'paragraph',
        parentId: blockquoteId,
        index: generateFractionalIndex(),
        content: parseInlineLeaves(trimmed.slice(2)),
      };

      i++;
      continue;
    }

    // 5. Task items (- [ ] or - [x])
    const taskMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      if (!activeTaskList) {
        const taskListId = generateId(IdType.Block);
        const index = generateFractionalIndex(prevIndex);
        prevIndex = index;
        activeTaskList = {
          id: taskListId,
          type: 'taskList',
          parentId,
          index,
          content: [],
        };
        blocks[taskListId] = activeTaskList;
      }

      const isChecked = taskMatch[1]?.toLowerCase() === 'x';
      const text = taskMatch[2] || '';

      const taskItemId = generateId(IdType.Block);
      const taskIndex = generateFractionalIndex();
      blocks[taskItemId] = {
        id: taskItemId,
        type: 'taskItem',
        parentId: activeTaskList.id,
        index: taskIndex,
        attrs: { checked: isChecked },
      };

      const pId = generateId(IdType.Block);
      blocks[pId] = {
        id: pId,
        type: 'paragraph',
        parentId: taskItemId,
        index: generateFractionalIndex(),
        content: parseInlineLeaves(text),
      };

      i++;
      continue;
    }

    // 6. Bullet list (- or *)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      activeTaskList = null;
      const blockId = generateId(IdType.Block);
      const index = generateFractionalIndex(prevIndex);
      prevIndex = index;

      blocks[blockId] = {
        id: blockId,
        type: 'paragraph',
        parentId,
        index,
        content: parseInlineLeaves(`• ${trimmed.slice(2)}`),
      };
      i++;
      continue;
    }

    // 7. Regular paragraph
    activeTaskList = null;
    const blockId = generateId(IdType.Block);
    const index = generateFractionalIndex(prevIndex);
    prevIndex = index;

    blocks[blockId] = {
      id: blockId,
      type: 'paragraph',
      parentId,
      index,
      content: parseInlineLeaves(rawLine),
    };
    i++;
  }

  return blocks;
};

const parseInlineLeaves = (text: string) => {
  if (!text) return [];
  // For simplicity and robust parsing, return text leaf.
  // Advanced marks can be preserved if needed.
  return [{ type: 'text', text }];
};

export const blocksToMarkdown = (
  parentId: string,
  blocks?: Record<string, Block> | null
): string => {
  if (!blocks || Object.keys(blocks).length === 0) {
    return '';
  }

  // Find root-level blocks under parentId sorted by index
  const rootBlocks = Object.values(blocks)
    .filter((b) => b.parentId === parentId)
    .sort((a, b) => a.index.localeCompare(b.index));

  const extractText = (block: Block): string => {
    if (!block.content || block.content.length === 0) {
      return '';
    }
    return block.content
      .map((leaf) => leaf.text || '')
      .join('');
  };

  const output: string[] = [];

  for (const block of rootBlocks) {
    switch (block.type) {
      case 'heading1':
        output.push(`# ${extractText(block)}\n`);
        break;
      case 'heading2':
        output.push(`## ${extractText(block)}\n`);
        break;
      case 'heading3':
        output.push(`### ${extractText(block)}\n`);
        break;
      case 'codeBlock':
        output.push(`\`\`\`${(block.attrs?.language as string) || ''}\n${extractText(block)}\n\`\`\`\n`);
        break;
      case 'blockquote': {
        const children = Object.values(blocks)
          .filter((b) => b.parentId === block.id)
          .sort((a, b) => a.index.localeCompare(b.index));
        const quoteText = children.map(extractText).join('\n') || extractText(block);
        output.push(`> ${quoteText}\n`);
        break;
      }
      case 'taskList': {
        const taskItems = Object.values(blocks)
          .filter((b) => b.parentId === block.id)
          .sort((a, b) => a.index.localeCompare(b.index));
        for (const item of taskItems) {
          const checked = item.attrs?.checked ? 'x' : ' ';
          const innerP = Object.values(blocks)
            .filter((b) => b.parentId === item.id)
            .sort((a, b) => a.index.localeCompare(b.index));
          const text = innerP.map(extractText).join(' ') || extractText(item);
          output.push(`- [${checked}] ${text}`);
        }
        output.push('');
        break;
      }
      case 'paragraph':
      default:
        output.push(`${extractText(block)}\n`);
        break;
    }
  }

  return output.join('\n').trim();
};

