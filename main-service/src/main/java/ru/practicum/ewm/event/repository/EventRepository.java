package ru.practicum.ewm.event.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.Query;
import ru.practicum.ewm.event.model.Event;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EventRepository extends JpaRepository<Event, Long> {

    List<Event> findByInitiatorId(Long userId, Pageable pageable);

    Optional<Event> findByIdAndInitiatorId(Long eventId, Long userId);

    Page<Event> findAll(Pageable pageable);

    @Query(value = "SELECT * FROM events", nativeQuery = true)
    List<Event> findEventsForAdmin(Pageable pageable);

    @Query(value = "SELECT * FROM events e WHERE e.state = 'PUBLISHED'", nativeQuery = true)
    List<Event> findAllPublishedEvents(Pageable pageable);

    boolean existsByCategoryId(Long catId);
}