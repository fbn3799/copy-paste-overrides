// Figma Plugin to Copy & Paste Overrides
figma.showUI(__html__, { width: 400, height: 160 });

let copiedOverrides: { [key: string]: any } = {}; // Store copied overrides

// Function to extract properties from the selected instance (and nested instances)
function extractOverrides(instance: InstanceNode, path = ''): { [key: string]: any } {
  let overrides: { [key: string]: any } = {};

  for (const key in instance.componentProperties) {
    const property = instance.componentProperties[key];

    if (property && 'value' in property) {
      const fullKey = path ? `${path}.${key}` : key; // Create a unique key for nested properties
      overrides[fullKey] = property.value;
    }
  }

  // Recursively check nested instances
  for (const child of instance.children) {
    if (child.type === "INSTANCE") {
      Object.assign(overrides, extractOverrides(child, `${path}.${child.name}`.replace(/^\./, '')));
    }
  }

  return overrides;
}

// Handle plugin actions
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'copy') {
    const selectedNodes = figma.currentPage.selection;
    if (selectedNodes.length === 1 && selectedNodes[0].type === 'INSTANCE') {
      const instanceNode = selectedNodes[0];
      copiedOverrides = extractOverrides(instanceNode);
      console.log("Copied Overrides:", copiedOverrides);
      figma.notify('Overrides copied successfully!');
    } else {
      figma.notify('Please select a single instance to copy overrides from.');
    }
  }

  if (msg.type === 'paste') {
    const selectedNodes = figma.currentPage.selection;
    if (selectedNodes.length === 1 && selectedNodes[0].type === 'INSTANCE') {
      try {
        const instanceNode = selectedNodes[0];
        //console.log("Pasting Overrides:", copiedOverrides);

        let appliedProperties = false;

        // Get all available properties of the instance
        const availableProperties = instanceNode.componentProperties;

        for (const key in copiedOverrides) {
          // Handle nested instances
          const keyParts = key.split('.');
          if (keyParts.length > 1) {
            const instanceName = keyParts.slice(0, -1).join('.');
            const propKey = keyParts[keyParts.length - 1];
            const nestedInstance = instanceNode.findOne(node =>
              node.type === 'INSTANCE' && node.name.includes(instanceName)
            ) as InstanceNode | null;

            if (nestedInstance && nestedInstance.componentProperties) {
              console.log(`Found nested instance: ${nestedInstance.name}`);

              // Check if the property exists
              if (!(propKey in nestedInstance.componentProperties)) {
                console.warn(`Skipping "${key}" - property does not exist on nested instance.`);
                continue;
              }

              // Check allowed values
              const allowedValues = nestedInstance.componentProperties[propKey]?.preferredValues?.map(v => v.toString()) || [];
              //console.log(`Allowed values for "${propKey}" in "${nestedInstance.name}":`, allowedValues);

              if (allowedValues.length === 0 || allowedValues.includes(String(copiedOverrides[key]))) {
                if (!(propKey in nestedInstance.componentProperties)) {
                  console.error(`ERROR: Property "${propKey}" does not exist on "${nestedInstance.name}"`);
                  continue;
                }
                console.log(`✅ Property "${propKey}" found on "${nestedInstance.name}"`);
                if (nestedInstance && nestedInstance.componentProperties && propKey in nestedInstance.componentProperties) {
                  console.log(`🔹 Attempting to set "${propKey}" to "${copiedOverrides[key]}" in "${nestedInstance.name}"`);

                  try {
                    nestedInstance.setProperties({ [propKey]: copiedOverrides[key] });

                    // Check if the property actually got updated
                    const updatedValue = nestedInstance.componentProperties[propKey]?.value;
                    if (updatedValue === copiedOverrides[key]) {
                      console.log(`✅ Successfully updated "${propKey}" to "${copiedOverrides[key]}"`);
                    } else {
                      console.warn(`⚠️ Property update failed: "${propKey}" is now "${updatedValue}" instead of "${copiedOverrides[key]}"`);
                    }
                  } catch (error) {
                    console.error(`❌ Error setting property "${propKey}":`, error);
                  }
                }

                appliedProperties = true;
              } else {
                console.warn(`Skipping nested property "${key}" - Invalid variant value: "${copiedOverrides[key]}"`);
              }
              continue;
            } else {
              console.warn(`Skipping nested property "${key}" - Nested instance not found.`);
              continue;
            }
          }

          // Handle top-level overrides
          if (availableProperties[key]) {
            const allowedValues = availableProperties[key]?.preferredValues?.map(v => v.toString()) || [];

            if (allowedValues.length === 0 || allowedValues.includes(String(copiedOverrides[key]))) {
              console.log(`Applying override: ${key} -> ${copiedOverrides[key]}`);
              instanceNode.setProperties({ [key]: copiedOverrides[key] });
              appliedProperties = true;
            } else {
              console.warn(`Skipping property "${key}" - Invalid variant value: "${copiedOverrides[key]}"`);
            }
          } else {
            console.warn(`Skipping property "${key}" - does not exist on this instance.`);
          }
        }

        if (appliedProperties) {
          figma.notify('Overrides pasted successfully!');
        } else {
          figma.notify('No valid properties to paste.');
        }
      } catch (error) {
        figma.notify('Error pasting overrides: ' + (error instanceof Error ? error.message : String(error)));
      }
    } else {
      figma.notify('Please select a single instance to paste overrides onto.');
    }
  }


};
