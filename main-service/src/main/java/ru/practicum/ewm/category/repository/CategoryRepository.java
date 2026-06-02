package ru.practicum.ewm.category.repository;

import ru.practicum.ewm.category.model.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    Optional<Category> findByName(@NotBlank @Size(min = 1, max = 50) String name);
}