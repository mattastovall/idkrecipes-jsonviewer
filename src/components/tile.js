// components/Tile.js
import Image from 'next/image';
import styles from '../styles/Tile.module.css';

const Tile = ({ recipe, onClick, isChecked, onCheck }) => {
  // Find the first non-null image URL
  const firstValidImage = recipe.images?.find(img => img !== "null" && img !== null);

  return (
    <div className={styles.tile} onClick={onClick}>
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e) => onCheck(e.target.checked)}
        className={styles.checkbox}
        onClick={(e) => e.stopPropagation()}
      />
      
      <div className={styles.imageContainer}>
        {firstValidImage ? (
          <Image
            src={firstValidImage}
            alt={recipe.title}
            fill
            className={styles.image}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className={styles.noImage}>
            No Image Available
          </div>
        )}
      </div>

      <div className={styles.content}>
        <h2 className={styles.title}>{recipe.title}</h2>
        <p className={styles.description}>{recipe.description}</p>
      </div>
    </div>
  );
};

export default Tile;