-- One versioned RGB reference for Pro; preserve the previous catalog for audit.
DO $migration$
DECLARE
  reference_chart jsonb := $chart${
  "schemaVersion": 1,
  "revision": "aquachek-pro-reference-2026-10-13.1",
  "brandId": "aquachek-pro-5in1",
  "calibrationStatus": "user_supplied_label",
  "source": {
    "kind": "user-supplied-label-chart",
    "image": "aquachek-pro-user-reference-2026-10-13.jpg",
    "imageSha256": "5b78395fb5d9cd7c89d3adc29fd3016d0c9edd797a1f9d7ed30055709e3657e5",
    "sourceConfirmedByUserOn": "2026-10-13",
    "note": "The project owner identified this as a manufacturer/bottle-label chart. RGB values were digitized from the supplied JPEG. This is not field calibration or independent manufacturer verification."
  },
  "padOrder": [
    "totalChlorineAndBromine",
    "freeChlorine",
    "ph",
    "alkalinity"
  ],
  "parameters": {
    "totalChlorine": [
      {
        "value": 0,
        "rgb": [
          252,
          253,
          173
        ]
      },
      {
        "value": 0.5,
        "rgb": [
          241,
          254,
          174
        ]
      },
      {
        "value": 1,
        "rgb": [
          230,
          245,
          164
        ]
      },
      {
        "value": 3,
        "rgb": [
          185,
          215,
          143
        ]
      },
      {
        "value": 5,
        "rgb": [
          149,
          197,
          123
        ]
      },
      {
        "value": 10,
        "rgb": [
          86,
          162,
          97
        ]
      },
      {
        "value": 20,
        "rgb": [
          51,
          119,
          70
        ]
      }
    ],
    "bromine": [
      {
        "value": 0,
        "rgb": [
          252,
          253,
          173
        ]
      },
      {
        "value": 1,
        "rgb": [
          241,
          254,
          174
        ]
      },
      {
        "value": 2,
        "rgb": [
          230,
          245,
          164
        ]
      },
      {
        "value": 5,
        "rgb": [
          185,
          215,
          143
        ]
      },
      {
        "value": 10,
        "rgb": [
          149,
          197,
          123
        ]
      },
      {
        "value": 20,
        "rgb": [
          86,
          162,
          97
        ]
      },
      {
        "value": 40,
        "rgb": [
          51,
          119,
          70
        ]
      }
    ],
    "freeChlorine": [
      {
        "value": 0,
        "rgb": [
          252,
          254,
          205
        ]
      },
      {
        "value": 0.5,
        "rgb": [
          247,
          249,
          227
        ]
      },
      {
        "value": 1,
        "rgb": [
          231,
          222,
          217
        ]
      },
      {
        "value": 3,
        "rgb": [
          171,
          140,
          207
        ]
      },
      {
        "value": 5,
        "rgb": [
          156,
          107,
          188
        ]
      },
      {
        "value": 10,
        "rgb": [
          125,
          34,
          151
        ]
      },
      {
        "value": 20,
        "rgb": [
          83,
          18,
          108
        ]
      }
    ],
    "ph": [
      {
        "value": 6.2,
        "rgb": [
          235,
          178,
          75
        ]
      },
      {
        "value": 6.8,
        "rgb": [
          223,
          112,
          57
        ]
      },
      {
        "value": 7.2,
        "rgb": [
          217,
          86,
          60
        ]
      },
      {
        "value": 7.8,
        "rgb": [
          201,
          64,
          54
        ]
      },
      {
        "value": 8.4,
        "rgb": [
          173,
          54,
          50
        ]
      }
    ],
    "alkalinity": [
      {
        "value": 0,
        "rgb": [
          220,
          193,
          76
        ]
      },
      {
        "value": 40,
        "rgb": [
          162,
          170,
          61
        ]
      },
      {
        "value": 80,
        "rgb": [
          138,
          159,
          66
        ]
      },
      {
        "value": 120,
        "rgb": [
          75,
          110,
          56
        ]
      },
      {
        "value": 180,
        "rgb": [
          40,
          81,
          47
        ]
      },
      {
        "value": 240,
        "rgb": [
          46,
          86,
          96
        ]
      }
    ]
  }
}$chart$::jsonb;
BEGIN
  UPDATE public.strip_brands
  SET color_chart = reference_chart || jsonb_build_object(
    'previousNumericChart', coalesce(color_chart->'previousNumericChart', color_chart)
  ), updated_at = now()
  WHERE id = 'aquachek-pro-5in1';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AquaChek Pro catalog row is missing';
  END IF;
END;
$migration$;
