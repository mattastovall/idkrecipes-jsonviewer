// pages/index.js
import { useEffect, useState } from 'react';
import Tile from '../src/components/tile';
import Modal from '../src/components/modal';
import { supabase } from '../src/utils/supabaseClient';
import styles from '../src/styles/Home.module.css';

export default function Home() {
  const [recipes, setRecipes] = useState({});
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [checkedState, setCheckedState] = useState({});
  const [selectedImages, setSelectedImages] = useState([]);

  // Fetch JSON data on mount
  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/recipes.json');
      const data = await res.json();
      setRecipes(data);

      // Initialize checkedState and selectedImages from Supabase
      const { data: dbData, error } = await supabase
        .from('checked_states')
        .select('*');
      
      if (error) {
        console.error('Error fetching checked states:', error);
      } else {
        const state = {};
        const selectedImgs = [];
        dbData.forEach((item) => {
          state[item.recipe_name] = item.is_checked;
          if (item.selected_images) {
            selectedImgs.push(...item.selected_images);
          }
        });
        setCheckedState(state);
        setSelectedImages(selectedImgs);
      }
    };
    fetchData();
  }, []);

  // Set up real-time listener for checked states
  useEffect(() => {
    const channel = supabase
      .channel('checked_states_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'checked_states'
        },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            setCheckedState((prev) => ({
              ...prev,
              [newRow.recipe_name]: newRow.is_checked,
            }));
            
            // Update selected images
            setSelectedImages((prev) => {
              const otherRecipeImages = prev.filter(img => 
                !recipes[newRow.recipe_name]?.images.includes(img)
              );
              return [...otherRecipeImages, ...(newRow.selected_images || [])];
            });
          } else if (eventType === 'DELETE') {
            setCheckedState((prev) => {
              const updated = { ...prev };
              delete updated[oldRow.recipe_name];
              return updated;
            });
            // Remove deleted recipe's images from selection
            setSelectedImages((prev) => 
              prev.filter(img => !recipes[oldRow.recipe_name]?.images.includes(img))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.channel('checked_states_changes').unsubscribe();
    };
  }, [recipes]); // Added recipes as dependency

  // Modified handleImageSelect to update Supabase
  const handleImageSelect = async (selectedImages) => {
    setSelectedImages(selectedImages);
    
    // Get the current recipe name from selectedRecipe
    if (selectedRecipe) {
      const recipeName = Object.entries(recipes).find(
        ([_, recipe]) => recipe === selectedRecipe
      )?.[0];

      if (recipeName) {
        const { error } = await supabase
          .from('checked_states')
          .upsert(
            { 
              recipe_name: recipeName,
              is_checked: true,
              selected_images: selectedImages.filter(img => 
                selectedRecipe.images.includes(img)
              )
            },
            { onConflict: 'recipe_name' }
          );

        if (error) {
          console.error('Error updating selected images:', error);
        }
      }
    }
  };

  // Modified handleModalClose to handle selected images properly
  const handleModalClose = async () => {
    if (selectedRecipe) {
      const recipeName = Object.entries(recipes).find(
        ([_, recipe]) => recipe === selectedRecipe
      )?.[0];

      if (recipeName) {
        const { error } = await supabase
          .from('checked_states')
          .upsert(
            { 
              recipe_name: recipeName,
              is_checked: checkedState[recipeName],
              selected_images: selectedImages.filter(img => 
                selectedRecipe.images.includes(img)
              )
            },
            { onConflict: 'recipe_name' }
          );

        if (error) {
          console.error('Error saving modal state:', error);
        }
      }
    }
    setSelectedRecipe(null);
  };

  // Handle checkbox change
  const handleCheck = async (recipeName, isChecked) => {
    setCheckedState((prev) => ({ ...prev, [recipeName]: isChecked }));

    // Update selected images based on checkbox state
    setSelectedImages((prev) => {
      if (isChecked) {
        return [...prev, recipeName]; // Add to selected images
      } else {
        return prev.filter((name) => name !== recipeName); // Remove from selected images
      }
    });

    // Upsert the checked state in Supabase
    const { error } = await supabase
      .from('checked_states')
      .upsert(
        { recipe_name: recipeName, is_checked: isChecked },
        { onConflict: 'recipe_name' }
      );

    if (error) {
      console.error('Error updating checked state:', error);
    }
  };

  // Handle export
  const handleExport = () => {
    // Only get recipes that have their tiles checked
    const selectedRecipeNames = Object.entries(checkedState)
      .filter(([_, isChecked]) => isChecked)
      .map(([recipeName]) => recipeName);

    const selectedRecipes = selectedRecipeNames.reduce((obj, recipeName) => {
      // Only proceed if this recipe is actually selected (tile is checked)
      if (checkedState[recipeName]) {
        // Create a copy of the recipe
        const recipe = { ...recipes[recipeName] };
        // Get the selected images for this recipe from Supabase state
        if (recipe && recipe.images) {
          // Only include images that are in the selectedImages array
          recipe.images = recipe.images.filter(img => selectedImages.includes(img));
          // Only include the recipe if it has selected images
          if (recipe.images.length > 0) {
            obj[recipeName] = recipe;
          }
        }
      }
      return obj;
    }, {});

    const blob = new Blob([JSON.stringify(selectedRecipes, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'selected_recipes.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Recipe Viewer</h1>
      <button onClick={handleExport} className={styles.exportButton}>
        Export Selected
      </button>
      <div className={styles.grid}>
        {Object.entries(recipes).map(([recipeName, recipe]) => (
          <Tile
            key={recipeName}
            recipe={recipe}
            isChecked={checkedState[recipeName] || false}
            onCheck={(isChecked) => handleCheck(recipeName, isChecked)}
            onClick={() => setSelectedRecipe(recipe)}
          />
        ))}
      </div>
      <Modal
        isOpen={selectedRecipe !== null}
        onClose={handleModalClose}
        recipe={selectedRecipe}
        selectedImages={selectedImages}
        onImageSelect={handleImageSelect}
      />
    </div>
  );
}
