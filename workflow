{
    "name": "RAG AI Agent Template V4",
    "nodes": [
      {
        "parameters": {
          "model": "gpt-4.1-mini",
          "options": {}
        },
        "id": "2856e5c8-7bf4-4b56-9e3a-787bf3c173aa",
        "name": "OpenAI Chat Model",
        "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
        "typeVersion": 1,
        "position": [
          -736,
          368
        ],
        "credentials": {
          "openAiApi": {
            "id": "KnSSZQEFv82oFpIv",
            "name": "OpenAi account"
          }
        }
      },
      {
        "parameters": {
          "jsonMode": "expressionData",
          "jsonData": "={{ $json.content || $json.data || $json.text || $json.concatenated_data }}",
          "options": {
            "metadata": {
              "metadataValues": [
                {
                  "name": "=file_id",
                  "value": "={{ $('Set File ID').first().json.file_id }}"
                },
                {
                  "name": "file_title",
                  "value": "={{ $('Set File ID').first().json.file_title }}"
                }
              ]
            }
          }
        },
        "id": "f0e711e5-1261-48b4-9c39-1d44edd4e07a",
        "name": "Default Data Loader",
        "type": "@n8n/n8n-nodes-langchain.documentDefaultDataLoader",
        "typeVersion": 1,
        "position": [
          1008,
          1104
        ]
      },
      {
        "parameters": {
          "model": "text-embedding-3-small",
          "options": {}
        },
        "id": "dcecc97d-660b-476b-a583-e53638659c1f",
        "name": "Embeddings OpenAI1",
        "type": "@n8n/n8n-nodes-langchain.embeddingsOpenAi",
        "typeVersion": 1,
        "position": [
          800,
          1104
        ],
        "credentials": {
          "openAiApi": {
            "id": "KnSSZQEFv82oFpIv",
            "name": "OpenAi account"
          }
        }
      },
      {
        "parameters": {
          "content": "## Agent Tools for RAG",
          "height": 528.85546469693,
          "width": 583.4552380860637,
          "color": 4
        },
        "id": "05c8338a-4c93-4d47-b838-4dd478d68ffd",
        "name": "Sticky Note",
        "type": "n8n-nodes-base.stickyNote",
        "typeVersion": 1,
        "position": [
          0,
          0
        ]
      },
      {
        "parameters": {
          "content": "## Tool to Add a Google Drive File to Vector DB",
          "height": 867,
          "width": 3073,
          "color": 5
        },
        "id": "0faef96f-1615-4ed8-8e85-0ec44d6faa8e",
        "name": "Sticky Note1",
        "type": "n8n-nodes-base.stickyNote",
        "typeVersion": 1,
        "position": [
          -1744,
          544
        ]
      },
      {
        "parameters": {
          "operation": "download",
          "fileId": {
            "__rl": true,
            "value": "={{ $('Set File ID').item.json.file_id }}",
            "mode": "id"
          },
          "options": {
            "googleFileConversion": {
              "conversion": {
                "docsToFormat": "text/plain"
              }
            }
          }
        },
        "id": "028e43bf-1694-4450-983b-5cbd6508531e",
        "name": "Download File",
        "type": "n8n-nodes-base.googleDrive",
        "typeVersion": 3,
        "position": [
          -656,
          832
        ],
        "executeOnce": true,
        "credentials": {
          "googleDriveOAuth2Api": {
            "id": "gbJyysrPh0UJKin6",
            "name": "Google Drive account"
          }
        }
      },
      {
        "parameters": {
          "pollTimes": {
            "item": [
              {
                "mode": "everyMinute"
              }
            ]
          },
          "triggerOn": "specificFolder",
          "folderToWatch": {
            "__rl": true,
            "value": "1yfaYWtBKooyiiJbM3hQRda1v6aK0akdo",
            "mode": "list",
            "cachedResultName": "Neon n8n",
            "cachedResultUrl": "https://drive.google.com/drive/folders/1yfaYWtBKooyiiJbM3hQRda1v6aK0akdo"
          },
          "event": "fileCreated",
          "options": {}
        },
        "id": "1e702688-6e58-4cd8-81e6-81599ddcbeb8",
        "name": "File Created",
        "type": "n8n-nodes-base.googleDriveTrigger",
        "typeVersion": 1,
        "position": [
          -1680,
          672
        ],
        "credentials": {
          "googleDriveOAuth2Api": {
            "id": "gbJyysrPh0UJKin6",
            "name": "Google Drive account"
          }
        }
      },
      {
        "parameters": {
          "pollTimes": {
            "item": [
              {
                "mode": "everyMinute"
              }
            ]
          },
          "triggerOn": "specificFolder",
          "folderToWatch": {
            "__rl": true,
            "value": "1yfaYWtBKooyiiJbM3hQRda1v6aK0akdo",
            "mode": "list",
            "cachedResultName": "Neon n8n",
            "cachedResultUrl": "https://drive.google.com/drive/folders/1yfaYWtBKooyiiJbM3hQRda1v6aK0akdo"
          },
          "event": "fileUpdated",
          "options": {}
        },
        "id": "096aa7f1-efe4-4c42-9ec5-7e84fafab748",
        "name": "File Updated",
        "type": "n8n-nodes-base.googleDriveTrigger",
        "typeVersion": 1,
        "position": [
          -1680,
          832
        ],
        "credentials": {
          "googleDriveOAuth2Api": {
            "id": "gbJyysrPh0UJKin6",
            "name": "Google Drive account"
          }
        }
      },
      {
        "parameters": {
          "operation": "text",
          "options": {}
        },
        "id": "480f4079-e24e-4622-b181-a4d5b3b4283e",
        "name": "Extract Document Text",
        "type": "n8n-nodes-base.extractFromFile",
        "typeVersion": 1,
        "position": [
          48,
          1248
        ],
        "alwaysOutputData": true
      },
      {
        "parameters": {},
        "id": "5e4b534b-35a2-4655-98ad-4b193b4c99ce",
        "name": "Postgres Chat Memory",
        "type": "@n8n/n8n-nodes-langchain.memoryPostgresChat",
        "typeVersion": 1,
        "position": [
          -608,
          368
        ],
        "notesInFlow": false,
        "credentials": {
          "postgres": {
            "id": "n20dMLQ5iIiraxxT",
            "name": "RAG Neon"
          }
        }
      },
      {
        "parameters": {
          "assignments": {
            "assignments": [
              {
                "id": "10646eae-ae46-4327-a4dc-9987c2d76173",
                "name": "file_id",
                "value": "={{ $json.id }}",
                "type": "string"
              },
              {
                "id": "f4536df5-d0b1-4392-bf17-b8137fb31a44",
                "name": "file_type",
                "value": "={{ $json.mimeType }}",
                "type": "string"
              },
              {
                "id": "77d782de-169d-4a46-8a8e-a3831c04d90f",
                "name": "file_title",
                "value": "={{ $json.name }}",
                "type": "string"
              },
              {
                "id": "9bde4d7f-e4f3-4ebd-9338-dce1350f9eab",
                "name": "file_url",
                "value": "={{ $json.webViewLink }}",
                "type": "string"
              }
            ]
          },
          "options": {}
        },
        "id": "f9226a30-cc37-42b4-b885-d5085ef77ed4",
        "name": "Set File ID",
        "type": "n8n-nodes-base.set",
        "typeVersion": 3.4,
        "position": [
          -1328,
          832
        ]
      },
      {
        "parameters": {
          "content": "## RAG AI Agent with Chat Interface",
          "height": 464.8027193303974,
          "width": 1035.6381264595484
        },
        "id": "3a3533e6-b401-4469-a5db-efc99778b27b",
        "name": "Sticky Note2",
        "type": "n8n-nodes-base.stickyNote",
        "typeVersion": 1,
        "position": [
          -1040,
          64
        ]
      },
      {
        "parameters": {
          "options": {}
        },
        "id": "7ed020d2-0630-4ee7-8de5-6d615c4acd16",
        "name": "Respond to Webhook",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.1,
        "position": [
          -176,
          144
        ]
      },
      {
        "parameters": {
          "assignments": {
            "assignments": [
              {
                "id": "9a9a245e-f1a1-4282-bb02-a81ffe629f0f",
                "name": "chatInput",
                "value": "={{ $json?.chatInput || $json.body.chatInput }}",
                "type": "string"
              },
              {
                "id": "b80831d8-c653-4203-8706-adedfdb98f77",
                "name": "sessionId",
                "value": "={{ $json?.sessionId || $json.body.sessionId}}",
                "type": "string"
              }
            ]
          },
          "options": {}
        },
        "id": "626a0595-7173-4c4e-a58a-5f7d603b0627",
        "name": "Edit Fields",
        "type": "n8n-nodes-base.set",
        "typeVersion": 3.4,
        "position": [
          -736,
          144
        ]
      },
      {
        "parameters": {
          "public": true,
          "options": {}
        },
        "id": "5ebe5886-3b3e-40be-8009-31385aa5af68",
        "name": "When chat message received",
        "type": "@n8n/n8n-nodes-langchain.chatTrigger",
        "typeVersion": 1.1,
        "position": [
          -1008,
          144
        ],
        "webhookId": "e104e40e-6134-4825-a6f0-8a646d882662"
      },
      {
        "parameters": {
          "httpMethod": "POST",
          "path": "bf4dd093-bb02-472c-9454-7ab9af97bd1d",
          "authentication": "headerAuth",
          "responseMode": "responseNode",
          "options": {}
        },
        "id": "b89a8c4b-5405-4459-b7c5-86e29c051a54",
        "name": "Webhook",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": [
          -1008,
          352
        ],
        "webhookId": "bf4dd093-bb02-472c-9454-7ab9af97bd1d",
        "credentials": {
          "httpHeaderAuth": {
            "id": "JRUGn1oQQ24chZwD",
            "name": "Dynamous Circle"
          }
        }
      },
      {
        "parameters": {
          "operation": "pdf",
          "options": {}
        },
        "id": "66afec57-82f3-490c-8672-2fb604f35abe",
        "name": "Extract PDF Text",
        "type": "n8n-nodes-base.extractFromFile",
        "typeVersion": 1,
        "position": [
          48,
          1072
        ]
      },
      {
        "parameters": {
          "aggregate": "aggregateAllItemData",
          "options": {}
        },
        "id": "9c879720-80e1-4c0c-8d42-719d50580403",
        "name": "Aggregate",
        "type": "n8n-nodes-base.aggregate",
        "typeVersion": 1,
        "position": [
          256,
          640
        ]
      },
      {
        "parameters": {
          "fieldsToSummarize": {
            "values": [
              {
                "aggregation": "concatenate",
                "field": "data"
              }
            ]
          },
          "options": {}
        },
        "id": "1bdc0cd4-bd2a-410a-b4c1-91b69c0168f6",
        "name": "Summarize",
        "type": "n8n-nodes-base.summarize",
        "typeVersion": 1,
        "position": [
          464,
          720
        ]
      },
      {
        "parameters": {
          "promptType": "define",
          "text": "={{ $json.chatInput }}",
          "options": {
            "systemMessage": "You are a personal assistant who helps answer questions from a corpus of documents. The documents are either text based (Txt, docs, extracted PDFs, etc.) or tabular data (CSVs or Excel documents).\n\nYou are given tools to perform RAG in the 'documents' table, look up the documents available in your knowledge base in the 'document_metadata' table, extract all the text from a given document, and query the tabular files with SQL in the 'document_rows' table.\n\nAlways start by performing RAG unless the question requires a SQL query for tabular data (fetching a sum, finding a max, something a RAG lookup would be unreliable for). If RAG doesn't help, then look at the documents that are available to you, find a few that you think would contain the answer, and then analyze those.\n\nAlways tell the user if you didn't find the answer. Don't make something up just to please them."
          }
        },
        "id": "2406600d-2d60-48dc-8954-49290dc0a9a0",
        "name": "RAG AI Agent",
        "type": "@n8n/n8n-nodes-langchain.agent",
        "typeVersion": 1.6,
        "position": [
          -528,
          144
        ]
      },
      {
        "parameters": {
          "rules": {
            "values": [
              {
                "conditions": {
                  "options": {
                    "caseSensitive": true,
                    "leftValue": "",
                    "typeValidation": "strict",
                    "version": 1
                  },
                  "conditions": [
                    {
                      "id": "2ae7faa7-a936-4621-a680-60c512163034",
                      "leftValue": "=FixedExpression{{ $('Set File ID').item.json.file_type }}FixedExpressionRename Output FixedExpression{{ $('Set File ID').item.json.file_type }}",
                      "rightValue": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                      "operator": {
                        "type": "string",
                        "operation": "equals",
                        "name": "filter.operator.equals"
                      }
                    }
                  ],
                  "combinator": "and"
                }
              },
              {
                "conditions": {
                  "options": {
                    "caseSensitive": true,
                    "leftValue": "",
                    "typeValidation": "strict",
                    "version": 1
                  },
                  "conditions": [
                    {
                      "id": "fc193b06-363b-4699-a97d-e5a850138b0e",
                      "leftValue": "={{ $('Set File ID').item.json.file_type }}",
                      "rightValue": "=application/vnd.google-apps.spreadsheet",
                      "operator": {
                        "type": "string",
                        "operation": "equals",
                        "name": "filter.operator.equals"
                      }
                    }
                  ],
                  "combinator": "and"
                }
              },
              {
                "conditions": {
                  "options": {
                    "caseSensitive": true,
                    "leftValue": "",
                    "typeValidation": "strict",
                    "version": 1
                  },
                  "conditions": [
                    {
                      "leftValue": "={{ $('Set File ID').item.json.file_type }}",
                      "rightValue": "application/pdf",
                      "operator": {
                        "type": "string",
                        "operation": "equals"
                      },
                      "id": "5fe78f9b-2ff3-4adc-954e-53bfce35c142"
                    }
                  ],
                  "combinator": "and"
                }
              },
              {
                "conditions": {
                  "options": {
                    "caseSensitive": true,
                    "leftValue": "",
                    "typeValidation": "strict",
                    "version": 1
                  },
                  "conditions": [
                    {
                      "id": "b69f5605-0179-4b02-9a32-e34bb085f82d",
                      "leftValue": "={{ $('Set File ID').item.json.file_type }}",
                      "rightValue": "application/vnd.google-apps.document",
                      "operator": {
                        "type": "string",
                        "operation": "equals",
                        "name": "filter.operator.equals"
                      }
                    }
                  ],
                  "combinator": "and"
                }
              }
            ]
          },
          "options": {
            "fallbackOutput": "extra"
          }
        },
        "id": "a58f7965-35d5-47ba-89a5-2d1f3a87db45",
        "name": "Switch",
        "type": "n8n-nodes-base.switch",
        "typeVersion": 3,
        "position": [
          -464,
          800
        ]
      },
      {
        "parameters": {
          "operation": "xlsx",
          "options": {}
        },
        "id": "e3f023ef-7f50-4151-9546-2c4e4110c61f",
        "name": "Extract from Excel",
        "type": "n8n-nodes-base.extractFromFile",
        "typeVersion": 1,
        "position": [
          48,
          640
        ]
      },
      {
        "parameters": {
          "assignments": {
            "assignments": [
              {
                "id": "f422e2e0-381c-46ea-8f38-3f58c501d8b9",
                "name": "schema",
                "value": "={{ $('Extract from Excel').isExecuted ? $('Extract from Excel').first().json.keys().toJsonString() : $('Extract from CSV').first().json.keys().toJsonString() }}",
                "type": "string"
              },
              {
                "id": "bb07c71e-5b60-4795-864c-cc3845b6bc46",
                "name": "data",
                "value": "={{ $json.concatenated_data }}",
                "type": "string"
              }
            ]
          },
          "options": {}
        },
        "type": "n8n-nodes-base.set",
        "typeVersion": 3.4,
        "position": [
          880,
          656
        ],
        "id": "8c8138f3-46bf-4bd2-b2f7-13f413b06306",
        "name": "Set Schema"
      },
      {
        "parameters": {
          "options": {}
        },
        "type": "n8n-nodes-base.extractFromFile",
        "typeVersion": 1,
        "position": [
          48,
          816
        ],
        "id": "9183c4ee-d775-4405-b538-bc20dca6b879",
        "name": "Extract from CSV"
      },
      {
        "parameters": {
          "content": "## Run Each Node Once to Set Up Database Tables",
          "height": 300,
          "width": 680,
          "color": 3
        },
        "type": "n8n-nodes-base.stickyNote",
        "position": [
          -1744,
          224
        ],
        "typeVersion": 1,
        "id": "23698d8e-fb73-4387-ae4c-39ac20f791a1",
        "name": "Sticky Note3"
      },
      {
        "parameters": {
          "operation": "executeQuery",
          "query": "CREATE TABLE document_metadata (\n    id TEXT PRIMARY KEY,\n    title TEXT,\n    url TEXT,\n    created_at TIMESTAMP DEFAULT NOW(),\n    schema TEXT\n);",
          "options": {}
        },
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.5,
        "position": [
          -1632,
          320
        ],
        "id": "90672061-efa2-4f4e-83aa-b9363e7dab81",
        "name": "Create Document Metadata Table",
        "credentials": {
          "postgres": {
            "id": "n20dMLQ5iIiraxxT",
            "name": "RAG Neon"
          }
        }
      },
      {
        "parameters": {
          "operation": "executeQuery",
          "query": "CREATE TABLE document_rows (\n    id SERIAL PRIMARY KEY,\n    dataset_id TEXT REFERENCES document_metadata(id),\n    row_data JSONB  -- Store the actual row data\n);",
          "options": {}
        },
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.5,
        "position": [
          -1328,
          320
        ],
        "id": "c4b5a772-61e3-46c8-8c30-60ac0ce265e8",
        "name": "Create Document Rows Table (for Tabular Data)",
        "credentials": {
          "postgres": {
            "id": "n20dMLQ5iIiraxxT",
            "name": "RAG Neon"
          }
        }
      },
      {
        "parameters": {
          "descriptionType": "manual",
          "toolDescription": "Use this tool to fetch all available documents, including the table schema if the file is a CSV or Excel file.",
          "operation": "select",
          "schema": {
            "__rl": true,
            "mode": "list",
            "value": "public"
          },
          "table": {
            "__rl": true,
            "value": "document_metadata",
            "mode": "list",
            "cachedResultName": "document_metadata"
          },
          "returnAll": true,
          "options": {}
        },
        "type": "n8n-nodes-base.postgresTool",
        "typeVersion": 2.5,
        "position": [
          -464,
          368
        ],
        "id": "1fbe65c8-722b-4566-a5d6-440ba4610ccd",
        "name": "List Documents",
        "credentials": {
          "postgres": {
            "id": "n20dMLQ5iIiraxxT",
            "name": "RAG Neon"
          }
        }
      },
      {
        "parameters": {
          "descriptionType": "manual",
          "toolDescription": "Given a file ID, fetches the text from the document.",
          "operation": "executeQuery",
          "query": "SELECT \n    string_agg(text, ' ') as document_text\nFROM documents_pg\n  WHERE metadata->>'file_id' = $1\nGROUP BY metadata->>'file_id';",
          "options": {
            "queryReplacement": "={{ $fromAI('file_id') }}"
          }
        },
        "type": "n8n-nodes-base.postgresTool",
        "typeVersion": 2.5,
        "position": [
          -320,
          368
        ],
        "id": "c8c97591-5abd-46b8-8a4b-a3a7db7dbe91",
        "name": "Get File Contents",
        "credentials": {
          "postgres": {
            "id": "n20dMLQ5iIiraxxT",
            "name": "RAG Neon"
          }
        }
      },
      {
        "parameters": {
          "descriptionType": "manual",
          "toolDescription": "Run a SQL query - use this to query from the document_rows table once you know the file ID you are querying. dataset_id is the file_id and you are always using the row_data for filtering, which is a jsonb field that has all the keys from the file schema given in the document_metadata table.\n\nExample query:\n\nSELECT AVG((row_data->>'revenue')::numeric)\nFROM document_rows\nWHERE dataset_id = '123';\n\nExample query 2:\n\nSELECT \n    row_data->>'category' as category,\n    SUM((row_data->>'sales')::numeric) as total_sales\nFROM dataset_rows\nWHERE dataset_id = '123'\nGROUP BY row_data->>'category';",
          "operation": "executeQuery",
          "query": "{{ $fromAI('sql_query') }}",
          "options": {}
        },
        "type": "n8n-nodes-base.postgresTool",
        "typeVersion": 2.5,
        "position": [
          -160,
          368
        ],
        "id": "e64fc6e1-8917-4216-bdcb-7f08413b1b30",
        "name": "Query Document Rows",
        "credentials": {
          "postgres": {
            "id": "n20dMLQ5iIiraxxT",
            "name": "RAG Neon"
          }
        }
      },
      {
        "parameters": {
          "options": {}
        },
        "type": "@n8n/n8n-nodes-langchain.embeddingsOpenAi",
        "typeVersion": 1.2,
        "position": [
          128,
          352
        ],
        "id": "92ce6e4a-823e-476d-952a-6bc5f137728a",
        "name": "Embeddings OpenAI2",
        "credentials": {
          "openAiApi": {
            "id": "KnSSZQEFv82oFpIv",
            "name": "OpenAi account"
          }
        }
      },
      {
        "parameters": {
          "options": {
            "reset": false
          }
        },
        "type": "n8n-nodes-base.splitInBatches",
        "typeVersion": 3,
        "position": [
          -1504,
          672
        ],
        "id": "f2d74016-d26d-4b01-b333-46d4b90da6c5",
        "name": "Loop Over Items"
      },
      {
        "parameters": {
          "operation": "upsert",
          "schema": {
            "__rl": true,
            "mode": "list",
            "value": "public"
          },
          "table": {
            "__rl": true,
            "value": "document_metadata",
            "mode": "list",
            "cachedResultName": "document_metadata"
          },
          "columns": {
            "mappingMode": "defineBelow",
            "value": {
              "id": "={{ $('Set File ID').item.json.file_id }}",
              "title": "={{ $('Set File ID').item.json.file_title }}",
              "url": "={{ $('Set File ID').item.json.file_url }}"
            },
            "matchingColumns": [
              "id"
            ],
            "schema": [
              {
                "id": "id",
                "displayName": "id",
                "required": true,
                "defaultMatch": true,
                "display": true,
                "type": "string",
                "canBeUsedToMatch": true,
                "removed": false
              },
              {
                "id": "title",
                "displayName": "title",
                "required": false,
                "defaultMatch": false,
                "display": true,
                "type": "string",
                "canBeUsedToMatch": false
              },
              {
                "id": "url",
                "displayName": "url",
                "required": false,
                "defaultMatch": false,
                "display": true,
                "type": "string",
                "canBeUsedToMatch": false,
                "removed": false
              },
              {
                "id": "created_at",
                "displayName": "created_at",
                "required": false,
                "defaultMatch": false,
                "display": true,
                "type": "dateTime",
                "canBeUsedToMatch": false
              },
              {
                "id": "schema",
                "displayName": "schema",
                "required": false,
                "defaultMatch": false,
                "display": true,
                "type": "string",
                "canBeUsedToMatch": false,
                "removed": true
              }
            ],
            "attemptToConvertTypes": false,
            "convertFieldsToString": false
          },
          "options": {}
        },
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.5,
        "position": [
          -816,
          688
        ],
        "id": "c2a7d191-45cd-4b1d-90d4-f108af6f417e",
        "name": "Insert Document Metadata",
        "executeOnce": true,
        "credentials": {
          "postgres": {
            "id": "n20dMLQ5iIiraxxT",
            "name": "RAG Neon"
          }
        }
      },
      {
        "parameters": {
          "schema": {
            "__rl": true,
            "mode": "list",
            "value": "public"
          },
          "table": {
            "__rl": true,
            "value": "document_rows",
            "mode": "list",
            "cachedResultName": "document_rows"
          },
          "columns": {
            "mappingMode": "defineBelow",
            "value": {
              "dataset_id": "={{ $('Set File ID').item.json.file_id }}",
              "row_data": "={{ $json.toJsonString().replaceAll(/'/g, \"''\") }}"
            },
            "matchingColumns": [
              "id"
            ],
            "schema": [
              {
                "id": "id",
                "displayName": "id",
                "required": false,
                "defaultMatch": true,
                "display": true,
                "type": "number",
                "canBeUsedToMatch": true,
                "removed": true
              },
              {
                "id": "dataset_id",
                "displayName": "dataset_id",
                "required": false,
                "defaultMatch": false,
                "display": true,
                "type": "string",
                "canBeUsedToMatch": true
              },
              {
                "id": "row_data",
                "displayName": "row_data",
                "required": false,
                "defaultMatch": false,
                "display": true,
                "type": "object",
                "canBeUsedToMatch": true
              }
            ],
            "attemptToConvertTypes": false,
            "convertFieldsToString": false
          },
          "options": {}
        },
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.5,
        "position": [
          256,
          816
        ],
        "id": "70f0e434-5d61-400d-a1d2-662a19394772",
        "name": "Insert Table Rows",
        "credentials": {
          "postgres": {
            "id": "n20dMLQ5iIiraxxT",
            "name": "RAG Neon"
          }
        }
      },
      {
        "parameters": {
          "operation": "upsert",
          "schema": {
            "__rl": true,
            "mode": "list",
            "value": "public"
          },
          "table": {
            "__rl": true,
            "value": "document_metadata",
            "mode": "list",
            "cachedResultName": "document_metadata"
          },
          "columns": {
            "mappingMode": "defineBelow",
            "value": {
              "id": "={{ $('Set File ID').item.json.file_id }}",
              "schema": "={{ $json.schema }}"
            },
            "matchingColumns": [
              "id"
            ],
            "schema": [
              {
                "id": "id",
                "displayName": "id",
                "required": true,
                "defaultMatch": true,
                "display": true,
                "type": "string",
                "canBeUsedToMatch": true,
                "removed": false
              },
              {
                "id": "title",
                "displayName": "title",
                "required": false,
                "defaultMatch": false,
                "display": true,
                "type": "string",
                "canBeUsedToMatch": false,
                "removed": true
              },
              {
                "id": "url",
                "displayName": "url",
                "required": false,
                "defaultMatch": false,
                "display": true,
                "type": "string",
                "canBeUsedToMatch": false,
                "removed": true
              },
              {
                "id": "created_at",
                "displayName": "created_at",
                "required": false,
                "defaultMatch": false,
                "display": true,
                "type": "dateTime",
                "canBeUsedToMatch": false
              },
              {
                "id": "schema",
                "displayName": "schema",
                "required": false,
                "defaultMatch": false,
                "display": true,
                "type": "string",
                "canBeUsedToMatch": false,
                "removed": false
              }
            ],
            "attemptToConvertTypes": false,
            "convertFieldsToString": false
          },
          "options": {}
        },
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.5,
        "position": [
          1104,
          656
        ],
        "id": "a1decaeb-2c2b-4d0c-b54e-c425a3fcb149",
        "name": "Update Schema for Document Metadata",
        "credentials": {
          "postgres": {
            "id": "n20dMLQ5iIiraxxT",
            "name": "RAG Neon"
          }
        }
      },
      {
        "parameters": {
          "content": "## 🚀 Ultimate n8n Agentic RAG Template\n\n**Author:** [Cole Medin](https://www.youtube.com/@ColeMedin)\n\n## What is this?\nThis template provides a complete implementation of an **Agentic RAG (Retrieval Augmented Generation)** system in n8n that can be extended easily for your specific use case and knowledge base. Unlike standard RAG which only performs simple lookups, this agent can reason about your knowledge base, self-improve retrieval, and dynamically switch between different tools based on the specific question. This agent uses Postgres with PGVector for the knowledgebase. You can use Supabase, Neon, self host Postgres, etc.\n\n## Why Agentic RAG?\nStandard RAG has significant limitations:\n- Poor analysis of numerical/tabular data\n- Missing context due to document chunking\n- Inability to connect information across documents\n- No dynamic tool selection based on question type\n\n## What makes this template powerful:\n- **Intelligent tool selection**: Switches between RAG lookups, SQL queries, or full document retrieval based on the question\n- **Complete document context**: Accesses entire documents when needed instead of just chunks\n- **Accurate numerical analysis**: Uses SQL for precise calculations on spreadsheet/tabular data\n- **Cross-document insights**: Connects information across your entire knowledge base\n- **Multi-file processing**: Handles multiple documents in a single workflow loop\n- **Efficient storage**: Uses JSONB in Postgres to store tabular data without creating new tables for each CSV\n\n## Getting Started\n1. Run the table creation nodes first to set up your database tables in Postgres\n2. Upload your documents through Google Drive (or swap out for a different file storage solution)\n3. The agent will process them automatically (chunking text, storing tabular data in Postgres)\n4. Start asking questions that leverage the agent's multiple reasoning approaches\n\n## Customization\nThis template provides a solid foundation that you can extend by:\n- Tuning the system prompt for your specific use case\n- Adding document metadata like summaries\n- Implementing more advanced RAG techniques\n- Optimizing for larger knowledge bases",
          "height": 1192,
          "width": 540,
          "color": 6
        },
        "type": "n8n-nodes-base.stickyNote",
        "position": [
          -2320,
          224
        ],
        "typeVersion": 1,
        "id": "2dd09d65-243d-4552-8c28-4f84d8d0c623",
        "name": "Sticky Note9"
      },
      {
        "parameters": {
          "topN": 4
        },
        "type": "@n8n/n8n-nodes-langchain.rerankerCohere",
        "typeVersion": 1,
        "position": [
          320,
          352
        ],
        "id": "cca41507-3729-4d26-a8ab-6786662fd92e",
        "name": "Reranker Cohere",
        "credentials": {
          "cohereApi": {
            "id": "Ut4sDj13sHDbRuWz",
            "name": "CohereApi account"
          }
        }
      },
      {
        "parameters": {
          "mode": "retrieve-as-tool",
          "toolDescription": "Use RAG to look up information in the knowledgebase.",
          "tableName": "documents_pg",
          "topK": 25,
          "useReranker": true,
          "options": {}
        },
        "type": "@n8n/n8n-nodes-langchain.vectorStorePGVector",
        "typeVersion": 1.3,
        "position": [
          192,
          144
        ],
        "id": "a647b7c7-e621-473d-859d-54d2eb0cc904",
        "name": "Postgres PGVector Store",
        "credentials": {
          "postgres": {
            "id": "n20dMLQ5iIiraxxT",
            "name": "RAG Neon"
          }
        }
      },
      {
        "parameters": {
          "mode": "insert",
          "tableName": "documents_pg",
          "options": {}
        },
        "type": "@n8n/n8n-nodes-langchain.vectorStorePGVector",
        "typeVersion": 1.3,
        "position": [
          880,
          848
        ],
        "id": "0349fa7f-d1b2-4634-8a8e-6b04eaa86b13",
        "name": "Postgres PGVector Store1",
        "credentials": {
          "postgres": {
            "id": "n20dMLQ5iIiraxxT",
            "name": "RAG Neon"
          }
        }
      },
      {
        "parameters": {
          "operation": "executeQuery",
          "query": "DO $$\nBEGIN\n    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents_pg') THEN\n        EXECUTE 'DELETE FROM documents_pg WHERE metadata->>''file_id'' LIKE ''%' || $1 || '%''';\n    END IF;\nEND\n$$;",
          "options": {
            "queryReplacement": "={{ $json.file_id }}"
          }
        },
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.6,
        "position": [
          -1152,
          688
        ],
        "id": "960fdda9-304f-4706-bd82-271f6283513c",
        "name": "Delete Old Data Rows",
        "credentials": {
          "postgres": {
            "id": "n20dMLQ5iIiraxxT",
            "name": "RAG Neon"
          }
        }
      },
      {
        "parameters": {
          "operation": "executeQuery",
          "query": "DELETE FROM document_rows\nWHERE dataset_id LIKE '%' || $1 || '%';",
          "options": {
            "queryReplacement": "={{ $('Set File ID').item.json.file_id }}"
          }
        },
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.6,
        "position": [
          -976,
          848
        ],
        "id": "9dda6a22-c965-4603-9c7b-8f984effbb26",
        "name": "Delete Old Doc Rows",
        "credentials": {
          "postgres": {
            "id": "n20dMLQ5iIiraxxT",
            "name": "RAG Neon"
          }
        }
      },
      {
        "parameters": {
          "url": "https://www.googleapis.com/drive/v3/files",
          "authentication": "predefinedCredentialType",
          "nodeCredentialType": "googleDriveOAuth2Api",
          "sendQuery": true,
          "queryParameters": {
            "parameters": [
              {
                "name": "q",
                "value": "'1g7rnJHz14qbKel3CchFM6S0osMgXXblT' in parents and trashed = true"
              },
              {
                "name": "fields",
                "value": "files(id,name,mimeType,webViewLink,trashed,trashedTime)"
              },
              {
                "name": "pageSize",
                "value": "1000"
              }
            ]
          },
          "options": {}
        },
        "id": "6405351a-98ef-4bb8-aab2-44e83afbd08b",
        "name": "Get Trashed Files via API",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.1,
        "position": [
          -1440,
          1552
        ],
        "credentials": {
          "googleDriveOAuth2Api": {
            "id": "gbJyysrPh0UJKin6",
            "name": "Google Drive account"
          }
        }
      },
      {
        "parameters": {
          "jsCode": "// Parse the response from Google Drive API\nconst response = $input.first().json;\nconst trashedFiles = response.files || [];\n\nif (trashedFiles.length === 0) {\n  return [{ message: 'No trashed files found', count: 0 }];\n}\n\n// Return each file as a separate item for processing\nreturn trashedFiles.map(file => ({\n  file_id: file.id,\n  file_name: file.name,\n  file_type: file.mimeType,\n  file_url: file.webViewLink,\n  trashed_time: file.trashedTime\n}));"
        },
        "id": "878f685d-bd5e-4c6b-8007-794c37726f34",
        "name": "Parse Trashed Files",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [
          -1248,
          1552
        ]
      },
      {
        "parameters": {
          "conditions": {
            "options": {
              "conditions": [
                {
                  "value1": "={{ $json.file_id }}",
                  "operation": "isNotEmpty"
                }
              ]
            }
          },
          "options": {}
        },
        "id": "b0397d23-ea97-46e8-9492-6ceb3bed8e3b",
        "name": "Has Files to Delete?",
        "type": "n8n-nodes-base.if",
        "typeVersion": 2,
        "position": [
          -1040,
          1552
        ]
      },
      {
        "parameters": {
          "operation": "executeQuery",
          "query": "SELECT id FROM document_metadata WHERE id = '{{ $json.file_id }}'",
          "options": {}
        },
        "id": "631ee884-be96-4726-afc4-541efd033f1b",
        "name": "Check If Exists in DB",
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.5,
        "position": [
          -848,
          1552
        ],
        "credentials": {
          "postgres": {
            "id": "n20dMLQ5iIiraxxT",
            "name": "RAG Neon"
          }
        },
        "continueOnFail": true
      },
      {
        "parameters": {
          "conditions": {
            "options": {
              "caseSensitive": true,
              "leftValue": "",
              "typeValidation": "strict",
              "version": 1
            },
            "conditions": [
              {
                "id": "992a20a8-5b6a-4ea4-b021-7458435e131a",
                "leftValue": "",
                "rightValue": "",
                "operator": {
                  "type": "string",
                  "operation": "equals",
                  "name": "filter.operator.equals"
                }
              }
            ],
            "combinator": "and"
          },
          "options": {}
        },
        "id": "8cb5a255-73ba-4c9e-967f-81c203de81bf",
        "name": "Exists in DB?",
        "type": "n8n-nodes-base.if",
        "typeVersion": 2,
        "position": [
          -640,
          1552
        ]
      },
      {
        "parameters": {
          "content": "## Vector Store Cleanup (Periodically)\nScan the Google Drive Folder regularely and deletes non existent documents from the vector store as well.",
          "height": 305,
          "width": 1976,
          "color": 6
        },
        "id": "ebaad16e-5cf8-4343-8ef5-2e922404ca6e",
        "name": "Sticky Note8",
        "type": "n8n-nodes-base.stickyNote",
        "typeVersion": 1,
        "position": [
          -1744,
          1440
        ]
      },
      {
        "parameters": {
          "operation": "executeQuery",
          "query": "DELETE FROM document_metadata WHERE id = '{{ $('Parse Trashed Files').first().json.file_id }}'",
          "options": {}
        },
        "id": "e4876b8d-75c9-4f6d-b010-60896d039c1c",
        "name": "Delete Metadata",
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.5,
        "position": [
          -32,
          1552
        ],
        "credentials": {
          "postgres": {
            "id": "n20dMLQ5iIiraxxT",
            "name": "RAG Neon"
          }
        }
      },
      {
        "parameters": {
          "rule": {
            "interval": [
              {
                "field": "minutes",
                "minutesInterval": 15
              }
            ]
          }
        },
        "id": "31ce8c3a-dab1-4321-95af-cc105a1dcb68",
        "name": "Check Every 15 Minutes",
        "type": "n8n-nodes-base.scheduleTrigger",
        "typeVersion": 1.1,
        "position": [
          -1648,
          1552
        ]
      },
      {
        "parameters": {
          "operation": "executeQuery",
          "query": "DO $$\nBEGIN\n    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents_pg') THEN\n        EXECUTE 'DELETE FROM documents_pg WHERE metadata->>''file_id'' LIKE ''%' || $1 || '%''';\n    END IF;\nEND\n$$;",
          "options": {
            "queryReplacement": "={{ $('Parse Trashed Files').item.json.file_id }}"
          }
        },
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.6,
        "position": [
          -416,
          1552
        ],
        "id": "64d2a944-b345-4f31-af2c-1bfc05693582",
        "name": "Delete Old Data Rows1",
        "credentials": {
          "postgres": {
            "id": "n20dMLQ5iIiraxxT",
            "name": "RAG Neon"
          }
        }
      },
      {
        "parameters": {
          "operation": "executeQuery",
          "query": "DELETE FROM document_rows\nWHERE dataset_id LIKE '%' || $1 || '%';",
          "options": {
            "queryReplacement": "={{ $('Parse Trashed Files').first().json.file_id }}"
          }
        },
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.6,
        "position": [
          -224,
          1552
        ],
        "id": "857f8e80-3072-4df2-bee4-75c580dd3323",
        "name": "Delete Old Doc Rows1",
        "credentials": {
          "postgres": {
            "id": "n20dMLQ5iIiraxxT",
            "name": "RAG Neon"
          }
        }
      },
      {
        "parameters": {
          "options": {}
        },
        "type": "@n8n/n8n-nodes-langchain.textSplitterRecursiveCharacterTextSplitter",
        "typeVersion": 1,
        "position": [
          1088,
          1248
        ],
        "id": "bf8b70ff-3c04-401b-a51a-168b2ecf95ab",
        "name": "Recursive Character Text Splitter"
      },
      {
        "parameters": {
          "code": {
            "execute": {
              "code": "const { PromptTemplate } = require('@langchain/core/prompts');\n\nconst documentContent = $input.item.json?.data || $input.item.json?.text;\nconst maxChunkSize = 1000;\nconst minChunkSize = 400;\n\nif (!documentContent) {\n    throw new Error('No document found in input');\n}\n\nconst llm = await this.getInputConnectionData('ai_languageModel', 0);\n\nfunction cleanText(text) {\n    return text.replace(/\\s+/g, ' ').trim();\n}\n\nconst chunks = [];\nlet remainingText = cleanText(documentContent);\nlet chunkNumber = 1;\n\nif (remainingText.length <= maxChunkSize) {\n    chunks.push({\n        content: remainingText,\n        chunk: chunkNumber,\n        chunk_size: remainingText.length\n    });\n} else {\n    while (remainingText) {\n        const textToAnalyze = remainingText.substring(0, maxChunkSize);\n        \n        const promptText = `You are analyzing a document to find the best transition point to split it into meaningful sections.\n\nYour goal: Keep related content together and split where topics naturally transition.\n\nRead this text carefully and identify where one topic/section ends and another begins:\n\n${textToAnalyze}\n\nFind the best transition point that occurs BEFORE character position ${maxChunkSize}.\n\nLook for:\n- Section headings or topic changes\n- Paragraph boundaries where the subject shifts\n- Complete conclusions before new ideas start\n- Natural breaks between different aspects of the content\n\nOutput the LAST WORD that appears right before your chosen split point.\nJust the single word itself, nothing else.\nExample: If you want to split after \"The company was founded in 2022.\" then output: \"2022\"`;\n        \n        const prompt = PromptTemplate.fromTemplate(promptText);\n        const chain = prompt.pipe(llm);\n        \n        let breakPoint = maxChunkSize;\n        \n        try {\n            const response = await chain.invoke();\n            const responseText = response.content || response.text || response.toString();\n            const breakWord = responseText.trim();\n            \n            if (breakWord) {\n                // Find the last occurrence of this word in the text to analyze\n                const wordIndex = textToAnalyze.lastIndexOf(breakWord);\n                if (wordIndex !== -1) {\n                    // Split after the word (including any punctuation that follows)\n                    breakPoint = wordIndex + breakWord.length;\n                    // Move past any punctuation or single space after the word\n                    while (breakPoint < textToAnalyze.length && \n                           (textToAnalyze[breakPoint] === '.' || \n                            textToAnalyze[breakPoint] === '!' || \n                            textToAnalyze[breakPoint] === '?' || \n                            textToAnalyze[breakPoint] === ',' || \n                            textToAnalyze[breakPoint] === ';' || \n                            textToAnalyze[breakPoint] === ':' || \n                            textToAnalyze[breakPoint] === ' ')) {\n                        breakPoint++;\n                        // Stop after moving past one space\n                        if (textToAnalyze[breakPoint - 1] === ' ') break;\n                    }\n                    breakPoint = Math.min(breakPoint, maxChunkSize);\n                }\n            }\n        } catch (error) {\n            console.log('LLM failed to determine breakpoint, using max size:', error.message);\n            breakPoint = maxChunkSize;\n        }\n        \n        const chunk = remainingText.substring(0, breakPoint).trim();\n        \n        if (chunk) {\n            chunks.push({\n                content: chunk,\n                chunk: chunkNumber,\n                chunk_size: chunk.length\n            });\n            chunkNumber++;\n        }\n        \n        remainingText = remainingText.substring(breakPoint).trim();\n        \n        if (!remainingText) {\n            break;\n        }\n    }\n}\n\n// Merge chunks that are below minimum size with adjacent chunks if possible\nlet i = 0;\nwhile (i < chunks.length) {\n    if (chunks[i].chunk_size < minChunkSize) {\n        // Try to merge with next chunk first if it exists and won't exceed max\n        if (i + 1 < chunks.length && \n            chunks[i].chunk_size + chunks[i + 1].chunk_size <= maxChunkSize) {\n            // Merge current with next\n            chunks[i].content += ' ' + chunks[i + 1].content;\n            chunks[i].chunk_size = chunks[i].content.length;\n            chunks.splice(i + 1, 1);\n            // Don't increment i, check this chunk again in case it's still small\n        } \n        // Otherwise try to merge with previous chunk if it exists and won't exceed max\n        else if (i > 0 && \n                 chunks[i - 1].chunk_size + chunks[i].chunk_size <= maxChunkSize) {\n            // Merge current into previous\n            chunks[i - 1].content += ' ' + chunks[i].content;\n            chunks[i - 1].chunk_size = chunks[i - 1].content.length;\n            chunks.splice(i, 1);\n            // Don't increment i, we removed current chunk\n        } else {\n            // Can't merge without exceeding max, move on\n            i++;\n        }\n    } else {\n        i++;\n    }\n}\n\nconst returnData = chunks.map(chunk => ({\n    json: chunk\n}));\n\nreturn returnData;"
            }
          },
          "inputs": {
            "input": [
              {
                "type": "ai_languageModel",
                "maxConnections": 1,
                "required": true
              },
              {
                "type": "main",
                "required": true
              }
            ]
          },
          "outputs": {
            "output": [
              {
                "type": "main"
              }
            ]
          }
        },
        "type": "@n8n/n8n-nodes-langchain.code",
        "typeVersion": 1,
        "position": [
          320,
          1072
        ],
        "id": "1c240b22-8a6b-4c09-96ab-7c587d29fd47",
        "name": "LangChain Code"
      },
      {
        "parameters": {
          "model": {
            "__rl": true,
            "value": "gpt-4.1",
            "mode": "list",
            "cachedResultName": "gpt-4.1"
          },
          "options": {}
        },
        "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
        "typeVersion": 1.2,
        "position": [
          400,
          1264
        ],
        "id": "5ee27212-3b88-44cd-8d20-1ee7f5fcb435",
        "name": "OpenAI Chat Model1",
        "credentials": {
          "openAiApi": {
            "id": "KnSSZQEFv82oFpIv",
            "name": "OpenAi account"
          }
        }
      }
    ],
    "pinData": {},
    "connections": {
      "OpenAI Chat Model": {
        "ai_languageModel": [
          [
            {
              "node": "RAG AI Agent",
              "type": "ai_languageModel",
              "index": 0
            }
          ]
        ]
      },
      "Download File": {
        "main": [
          [
            {
              "node": "Switch",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "File Created": {
        "main": [
          [
            {
              "node": "Loop Over Items",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Extract Document Text": {
        "main": [
          [
            {
              "node": "LangChain Code",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Embeddings OpenAI1": {
        "ai_embedding": [
          [
            {
              "node": "Postgres PGVector Store1",
              "type": "ai_embedding",
              "index": 0
            }
          ]
        ]
      },
      "Default Data Loader": {
        "ai_document": [
          [
            {
              "node": "Postgres PGVector Store1",
              "type": "ai_document",
              "index": 0
            }
          ]
        ]
      },
      "Postgres Chat Memory": {
        "ai_memory": [
          [
            {
              "node": "RAG AI Agent",
              "type": "ai_memory",
              "index": 0
            }
          ]
        ]
      },
      "Set File ID": {
        "main": [
          [
            {
              "node": "Delete Old Data Rows",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "File Updated": {
        "main": [
          [
            {
              "node": "Loop Over Items",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Edit Fields": {
        "main": [
          [
            {
              "node": "RAG AI Agent",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "When chat message received": {
        "main": [
          [
            {
              "node": "Edit Fields",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Webhook": {
        "main": [
          [
            {
              "node": "Edit Fields",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Extract PDF Text": {
        "main": [
          [
            {
              "node": "LangChain Code",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Aggregate": {
        "main": [
          [
            {
              "node": "Summarize",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Summarize": {
        "main": [
          [
            {
              "node": "Set Schema",
              "type": "main",
              "index": 0
            },
            {
              "node": "Postgres PGVector Store1",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "RAG AI Agent": {
        "main": [
          [
            {
              "node": "Respond to Webhook",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Switch": {
        "main": [
          [
            {
              "node": "Extract from Excel",
              "type": "main",
              "index": 0
            }
          ],
          [
            {
              "node": "Extract from CSV",
              "type": "main",
              "index": 0
            }
          ],
          [
            {
              "node": "Extract PDF Text",
              "type": "main",
              "index": 0
            }
          ],
          [
            {
              "node": "Extract Document Text",
              "type": "main",
              "index": 0
            }
          ],
          [
            {
              "node": "Extract Document Text",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Extract from Excel": {
        "main": [
          [
            {
              "node": "Aggregate",
              "type": "main",
              "index": 0
            },
            {
              "node": "Insert Table Rows",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Set Schema": {
        "main": [
          [
            {
              "node": "Update Schema for Document Metadata",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Extract from CSV": {
        "main": [
          [
            {
              "node": "Aggregate",
              "type": "main",
              "index": 0
            },
            {
              "node": "Insert Table Rows",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Create Document Metadata Table": {
        "main": [
          []
        ]
      },
      "List Documents": {
        "ai_tool": [
          [
            {
              "node": "RAG AI Agent",
              "type": "ai_tool",
              "index": 0
            }
          ]
        ]
      },
      "Get File Contents": {
        "ai_tool": [
          [
            {
              "node": "RAG AI Agent",
              "type": "ai_tool",
              "index": 0
            }
          ]
        ]
      },
      "Query Document Rows": {
        "ai_tool": [
          [
            {
              "node": "RAG AI Agent",
              "type": "ai_tool",
              "index": 0
            }
          ]
        ]
      },
      "Embeddings OpenAI2": {
        "ai_embedding": [
          [
            {
              "node": "Postgres PGVector Store",
              "type": "ai_embedding",
              "index": 0
            }
          ]
        ]
      },
      "Loop Over Items": {
        "main": [
          [],
          [
            {
              "node": "Set File ID",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Insert Document Metadata": {
        "main": [
          [
            {
              "node": "Download File",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Reranker Cohere": {
        "ai_reranker": [
          [
            {
              "node": "Postgres PGVector Store",
              "type": "ai_reranker",
              "index": 0
            }
          ]
        ]
      },
      "Postgres PGVector Store": {
        "ai_tool": [
          [
            {
              "node": "RAG AI Agent",
              "type": "ai_tool",
              "index": 0
            }
          ]
        ]
      },
      "Postgres PGVector Store1": {
        "main": [
          [
            {
              "node": "Loop Over Items",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Delete Old Data Rows": {
        "main": [
          [
            {
              "node": "Delete Old Doc Rows",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Delete Old Doc Rows": {
        "main": [
          [
            {
              "node": "Insert Document Metadata",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Get Trashed Files via API": {
        "main": [
          [
            {
              "node": "Parse Trashed Files",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Parse Trashed Files": {
        "main": [
          [
            {
              "node": "Has Files to Delete?",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Has Files to Delete?": {
        "main": [
          [
            {
              "node": "Check If Exists in DB",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Check If Exists in DB": {
        "main": [
          [
            {
              "node": "Exists in DB?",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Exists in DB?": {
        "main": [
          [
            {
              "node": "Delete Old Data Rows1",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Check Every 15 Minutes": {
        "main": [
          [
            {
              "node": "Get Trashed Files via API",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Delete Old Data Rows1": {
        "main": [
          [
            {
              "node": "Delete Old Doc Rows1",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Delete Old Doc Rows1": {
        "main": [
          [
            {
              "node": "Delete Metadata",
              "type": "main",
              "index": 0
            }
          ]
        ]
      },
      "Recursive Character Text Splitter": {
        "ai_textSplitter": [
          [
            {
              "node": "Default Data Loader",
              "type": "ai_textSplitter",
              "index": 0
            }
          ]
        ]
      },
      "OpenAI Chat Model1": {
        "ai_languageModel": [
          [
            {
              "node": "LangChain Code",
              "type": "ai_languageModel",
              "index": 0
            }
          ]
        ]
      },
      "LangChain Code": {
        "main": [
          [
            {
              "node": "Postgres PGVector Store1",
              "type": "main",
              "index": 0
            }
          ]
        ]
      }
    },
    "active": true,
    "settings": {
      "executionOrder": "v1"
    },
    "versionId": "2850acdb-5701-47ea-a8b8-dc853fb48b8e",
    "meta": {
      "templateCredsSetupCompleted": true,
      "instanceId": "283ffa8d05f0aea5fd537be52c7be659b3a880d9175d738aa61bb7798a0dea8e"
    },
    "id": "cMZ9v2XXBPwm1bbP",
    "tags": []
  }