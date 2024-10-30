// components/Modal.js
import { useEffect, useState } from 'react';
import styles from '../styles/Modal.module.css';

const Modal = ({ isOpen, onClose, recipe, selectedImages = [], onImageSelect = () => {} }) => {
  const [localSelectedImages, setLocalSelectedImages] = useState({});

  useEffect(() => {
    if (recipe) {
      const initialSelection = recipe.images.reduce((acc, img) => {
        acc[img] = selectedImages.includes(img);
        return acc;
      }, {});
      setLocalSelectedImages(initialSelection);
    }
  }, [recipe, selectedImages]);

  const handleImageSelect = (img) => {
    setLocalSelectedImages((prev) => {
      const newSelection = { ...prev, [img]: !prev[img] };
      onImageSelect(Object.keys(newSelection).filter(key => newSelection[key]));
      return newSelection;
    });
  };
  
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !recipe) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={() => {
          console.log('Close button clicked');
          onClose();
        }}>
          ×
        </button>
        <h2 className={styles.title}>{recipe.title}</h2>
        
        <div className={styles.imageGrid}>
          {recipe.images && recipe.images.length > 0 ? (
            recipe.images
              .filter(img => img !== "null" && img !== null)
              .map((img, idx) => (
                <div key={idx} className={styles.imageContainer}>
                  <input
                    type="checkbox"
                    checked={localSelectedImages[img] || false}
                    onChange={() => handleImageSelect(img)}
                    className={styles.checkbox}
                  />
                  <img
                    src={img}
                    alt={`${recipe.title} ${idx + 1}`}
                    className={styles.image}
                  />
                </div>
              ))
          ) : (
            <div className={styles.noImage}>
              <span>No Images Available</span>
            </div>
          )}
        </div>

        <div className={styles.section}>
          <p><strong>Nationality:</strong> {recipe.nationality}</p>
          <p><strong>Vegan:</strong> {recipe.vegan ? 'Yes' : 'No'}</p>
          <p><strong>Description:</strong> {recipe.description}</p>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Ingredients:</h3>
          <ul className={styles.list}>
            {recipe.ingredients.map((ing, idx) => (
              <li key={idx}>
                {ing.quantity} {ing.unit} {ing.name} (
                {ing.metric.quantity} {ing.metric.unit})
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Nutritional Information:</h3>
          <ul className={styles.list}>
            <li><strong>Calories per Serving:</strong> {recipe.calories_per_serving}</li>
            <li><strong>Total Fat:</strong> {recipe.total_fat}</li>
            <li><strong>Cholesterol:</strong> {recipe.cholesterol}</li>
            <li><strong>Sodium:</strong> {recipe.sodium}</li>
            <li><strong>Total Carbohydrates:</strong> {recipe.total_carbohydrates}</li>
            <li><strong>Dietary Fiber:</strong> {recipe.dietary_fiber}</li>
            <li><strong>Protein:</strong> {recipe.protein}</li>
          </ul>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Steps:</h3>
          <ol className={styles.list}>
            {Object.keys(recipe.steps)
              .sort((a, b) => {
                const stepA = parseInt(a.replace('Step ', ''));
                const stepB = parseInt(b.replace('Step ', ''));
                return stepA - stepB;
              })
              .map((stepKey) => (
                <li key={stepKey}>{recipe.steps[stepKey]}</li>
              ))}
          </ol>
        </div>
      </div>
    </div>
  );
};

export default Modal;