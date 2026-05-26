package ru.practicum.ewm.event.repository;

import ru.practicum.ewm.event.model.Event;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface EventRepository extends JpaRepository<Event, Long> {

    List<Event> findByInitiatorId(Long userId, Pageable pageable);

    Optional<Event> findByIdAndInitiatorId(Long eventId, Long userId);

    @Query("SELECT e FROM Event e")
    List<Event> findEventsForAdmin(Pageable pageable);

    @Query("SELECT e FROM Event e WHERE e.state = 'PUBLISHED'")
    List<Event> findAllPublishedEvents(Pageable pageable);

    boolean existsByCategoryId(Long catId);
}