package ru.practicum.ewm.event.repository;

import ru.practicum.ewm.event.model.Event;
import ru.practicum.ewm.event.model.EventState;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface EventRepository extends JpaRepository<Event, Long> {

    List<Event> findByInitiatorId(Long userId, Pageable pageable);

    Optional<Event> findByIdAndInitiatorId(Long eventId, Long userId);

    @Query("SELECT e FROM Event e WHERE " +
            "(:users IS NULL OR e.initiator.id IN :users) AND " +
            "(:states IS NULL OR e.state IN :states) AND " +
            "(:categories IS NULL OR e.category.id IN :categories) AND " +
            "(:rangeStart IS NULL OR e.eventDate >= :rangeStart) AND " +
            "(:rangeEnd IS NULL OR e.eventDate <= :rangeEnd)")
    List<Event> findEventsForAdmin(@Param("users") List<Long> users,
                                   @Param("states") List<EventState> states,
                                   @Param("categories") List<Long> categories,
                                   @Param("rangeStart") LocalDateTime rangeStart,
                                   @Param("rangeEnd") LocalDateTime rangeEnd,
                                   Pageable pageable);

//    @Query(value = "SELECT * FROM events e WHERE e.state = 'PUBLISHED' " +
//            "AND (:text IS NULL OR :text = '' OR " +
//            "e.annotation ILIKE CONCAT('%', CAST(:text AS text), '%') OR " +
//            "e.description ILIKE CONCAT('%', CAST(:text AS text), '%')) " +
//            "AND (:categories IS NULL OR e.category_id IN (:categories)) " +
//            "AND (:paid IS NULL OR e.paid = :paid)",
//            nativeQuery = true)
//    List<Event> findPublishedEvents(@Param("text") String text,
//                                    @Param("categories") List<Long> categories,
//                                    @Param("paid") Boolean paid,
//                                    Pageable pageable);

    @Query("SELECT e FROM Event e WHERE e.state = 'PUBLISHED'")
    List<Event> findAllPublishedEvents(Pageable pageable);

    boolean existsByCategoryId(Long catId);
}