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
      try {
        const res = await fetch('/recipes.json');
        const data = await res.json();
        setRecipes(data);
        console.log('Fetched recipes:', data);

        // Fetch initial checked states and selected images from Supabase
        const { data: dbData, error } = await supabase
          .from('checked_states')
          .select('recipe_name, selected_images');
        
        if (error) {
          console.error('Error fetching checked states:', error);
          return;
        }

        console.log('Fetched checked_states data:', dbData);

        const state = {};
        const selectedImgs = [];
        dbData.forEach((item) => {
          state[item.recipe_name] = true; // Assuming all fetched recipes are checked
          if (item.selected_images && Array.isArray(item.selected_images)) {
            selectedImgs.push(...item.selected_images);
            console.log(`Recipe: ${item.recipe_name}, Image URLs:`, item.selected_images);
          }
        });
        setCheckedState(state);
        setSelectedImages(selectedImgs);
        console.log('Initialized checkedState:', state);
        console.log('Initialized selectedImages:', selectedImgs);
      } catch (err) {
        console.error('Error in fetchData:', err);
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
          console.log('Real-time payload:', payload);
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            setCheckedState((prev) => ({
              ...prev,
              [newRow.recipe_name]: newRow.is_checked,
            }));
            if (newRow.selected_images && Array.isArray(newRow.selected_images)) {
              setSelectedImages(newRow.selected_images);
              console.log('Updated selectedImages:', newRow.selected_images);
            }
          } else if (eventType === 'DELETE') {
            setCheckedState((prev) => {
              const updated = { ...prev };
              delete updated[oldRow.recipe_name];
              return updated;
            });
            // Remove deleted recipe's images from selection
            setSelectedImages((prev) => 
              prev.filter(img => !recipes[oldRow.recipe_name]?.images.some(recipeImg => recipeImg.url === img))
            );
            console.log('CheckedState and selectedImages updated after DELETE');
          }
        }
      )
      .subscribe();
  
    return () => {
      supabase.channel('checked_states_changes').unsubscribe();
    };
  }, [recipes]);

  // Handle image selection and update Supabase
  const handleImageSelect = async (selectedImagesArray) => {
    setSelectedImages(selectedImagesArray);
    console.log('handleImageSelect called with:', selectedImagesArray);
    
    if (selectedRecipe) {
      const recipeNameEntry = Object.entries(recipes).find(
        ([_, recipe]) => recipe === selectedRecipe
      );
      const recipeName = recipeNameEntry ? recipeNameEntry[0] : null;
  
      if (recipeName) {
        const imageUrls = selectedImagesArray;
  
        console.log('Submitting to Supabase for recipe:', recipeName, ' with images:', imageUrls);
  
        const { data, error } = await supabase
          .from('checked_states')
          .upsert(
            { 
              recipe_name: recipeName,
              is_checked: true,
              selected_images: imageUrls,
            },
            { onConflict: 'recipe_name' }
          )
          .select();
  
        if (error) {
          console.error('Error updating selected images:', error);
        } else {
          console.log('Selected images updated successfully:', data);
        }
      }
    }
  };

  // Handle modal close and update Supabase
  const handleModalClose = () => {
    console.log('handleModalClose called');
    setSelectedRecipe(null);
  };

  // Handle checkbox change
  const handleCheck = async (recipeName, isChecked) => {
    console.log(`handleCheck called for ${recipeName} with isChecked=${isChecked}`);
    setCheckedState((prev) => ({ ...prev, [recipeName]: isChecked }));

    // Update selected images based on checkbox state
    setSelectedImages((prev) => {
      let updatedImages = [...prev];
      if (isChecked) {
        // Add images
        const imagesToAdd = recipes[recipeName]?.images.map(img => img.url) || [];
        imagesToAdd.forEach(url => {
          if (!updatedImages.includes(url)) {
            updatedImages.push(url);
          }
        });
      } else {
        // Remove images
        const imagesToRemove = recipes[recipeName]?.images.map(img => img.url) || [];
        updatedImages = updatedImages.filter(url => !imagesToRemove.includes(url));
      }
      console.log('Updated selectedImages after handleCheck:', updatedImages);
      return updatedImages;
    });

    // Upsert the checked state in Supabase
    const { data, error } = await supabase
      .from('checked_states')
      .upsert(
        { recipe_name: recipeName, is_checked: isChecked },
        { onConflict: 'recipe_name' }
      )
      .select();

    if (error) {
      console.error('Error updating checked state:', error);
    } else {
      console.log('Checked state updated successfully for', recipeName, ':', data);
    }
  };

  // Handle export
  const handleExport = () => {
    console.log('handleExport called');
    // Only get recipes that have their tiles checked
    const selectedRecipeNames = Object.entries(checkedState)
      .filter(([_, isChecked]) => isChecked)
      .map(([recipeName]) => recipeName);
  
    const selectedRecipes = selectedRecipeNames.reduce((obj, recipeName) => {
      // Only proceed if this recipe is actually selected (tile is checked)
      if (checkedState[recipeName]) {
        // Create a copy of the recipe
        const recipe = { ...recipes[recipeName] };
        // Get the selected images for this recipe from selectedImages state
        if (recipe && recipe.images) {
          // Only include images that are in the selectedImages array
          recipe.images = recipe.images.filter(img => selectedImages.includes(img.url));
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
    console.log('Exported selected recipes');
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
